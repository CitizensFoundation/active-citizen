import { BaseProcessor } from "../baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../constants.js";
import { CreateSolutionsProcessor } from "../create/createSolutions.js";

//TODO: Pentalty for similar ideas in the ranking somehow
//TODO: Track the evolution of the population with a log of parents and mutations, family tree
export class EvolvePopulationProcessor extends CreateSolutionsProcessor {
  renderSolution(solution: IEngineSolution) {
    return JSON.stringify(
      {
        title: solution.title,
        description: solution.description,
        mainBenefitOfSolution: solution.mainBenefitOfSolution,
        mainObstacleToSolutionAdoption: solution.mainObstacleToSolutionAdoption,
      },
      null,
      2
    );
  }

  renderRecombinationPrompt(
    parentA: IEngineSolution,
    parentB: IEngineSolution
  ) {
    return [
      new SystemChatMessage(
        `
        As an AI genetic algorithm expert, your task is to create a new solution by merging the attributes of two parent solutions (Parent A and Parent B).

        Please consider the following guidelines when developing your merged solution:
        1. The merged solution should contain some attributes from both parents but in a new way - not merely the attributes from parent A followed by those from parent B.
        2. The title of the merged solution should be approximately the same length as the parent titles.
        3. The combination should be logical, meaningful and present a standalone solution to the problem at hand - not two solutions in one.
        4. Do not refer "the merged solution" in your output, the solution should be presented as a standalone solution.
        5. Output your merged solution in the following JSON format: { title, description, mainBenefitOfSolution, mainObstacleToSolutionAdoption }. Do not add any new JSON properties.
        6. Think step by step.
        `
      ),
      new HumanChatMessage(
        `
        ${this.renderProblemStatementSubProblemsAndEntities(
          this.currentSubProblemIndex!
        )}

        Parent A:
        ${this.renderSolution(parentA)}

        Parent B:
        ${this.renderSolution(parentB)}

        Generate and output JSON for the merged solution below:
        `
      ),
    ];
  }

  renderMutatePrompt(individual: IEngineSolution) {
    return [
      new SystemChatMessage(
        `
        As an AI genetic algorithm expert, your task is to mutate the solution presented below.

        Please consider the following guidelines:
        1. Implement mutation at a rate of ${IEngineConstants.evolution.mutationPromptChangesRate} changes.
        2. The mutation process should introduce new attributes or alter existing ones.
        3. Ensure that the mutation is logical and meaningful.
        4. The mutated solution should continue to offer a viable solution to the problem presented.
        5. Output your mutated solution in the following JSON format: { title, description, mainBenefitOfSolution, mainObstacleToSolutionAdoption }. Do not add any new JSON properties.
        6. Think step by step.
        `
      ),
      new HumanChatMessage(
        `
        ${this.renderProblemStatementSubProblemsAndEntities(
          this.currentSubProblemIndex!
        )}

        Solution to mutate:
        ${this.renderSolution(individual)}

        Generate and output JSON for the mutated solution below:
        `
      ),
    ];
  }

  async performRecombination(
    parentA: IEngineSolution,
    parentB: IEngineSolution
  ) {
    this.chat = new ChatOpenAI({
      temperature: IEngineConstants.evolutionRecombineModel.temperature,
      maxTokens: IEngineConstants.evolutionRecombineModel.maxOutputTokens,
      modelName: IEngineConstants.evolutionRecombineModel.name,
      verbose: IEngineConstants.evolutionRecombineModel.verbose,
    });

    return (await this.callLLM(
      "evolve-recombine-population",
      IEngineConstants.evolutionRecombineModel,
      this.renderRecombinationPrompt(parentA, parentB)
    )) as IEngineSolution;
  }

  async recombine(parentA: IEngineSolution, parentB: IEngineSolution) {
    const offspring = await this.performRecombination(parentA, parentB);
    return offspring;
  }

  async performMutation(individual: IEngineSolution) {
    this.logger.debug("Performing mutation");
    this.chat = new ChatOpenAI({
      temperature: IEngineConstants.evolutionMutateModel.temperature,
      maxTokens: IEngineConstants.evolutionMutateModel.maxOutputTokens,
      modelName: IEngineConstants.evolutionMutateModel.name,
      verbose: IEngineConstants.evolutionMutateModel.verbose,
    });

    this.logger.debug("Before mutation");

    try {
      const mutant = (await this.callLLM(
        "evolve-mutate-population",
        IEngineConstants.evolutionMutateModel,
        this.renderMutatePrompt(individual)
      )) as IEngineSolution;

      this.logger.debug("After mutation");

      return mutant;
    } catch (error) {
      this.logger.error("Error in mutation");
      this.logger.error(error);
      throw error;
    }
  }

  async mutate(individual: IEngineSolution) {
    try {
      const mutant = await this.performMutation(individual);
      return mutant;
    } catch (error) {
      this.logger.error("Error in mutate");
      this.logger.error(error);
      throw error;
    }
  }

  async getNewSolutions(alreadyCreatedSolutions: IEngineSolution[]) {
    this.logger.info(`Getting new solutions`);

    this.chat = new ChatOpenAI({
      temperature: IEngineConstants.evolveSolutionsModel.temperature,
      maxTokens: IEngineConstants.evolveSolutionsModel.maxOutputTokens,
      modelName: IEngineConstants.evolveSolutionsModel.name,
      verbose: IEngineConstants.evolveSolutionsModel.verbose,
    });

    let alreadyCreatedSolutionsText;

    if (alreadyCreatedSolutions.length > 0) {
      alreadyCreatedSolutionsText = alreadyCreatedSolutions
        .map((solution) => solution.title)
        .join("\n");
    }

    const textContexts = await this.getTextContext(
      this.currentSubProblemIndex!,
      alreadyCreatedSolutionsText
    );

    this.logger.debug(
      `Evolution Text contexts: ${JSON.stringify(textContexts, null, 2)}`
    );

    const newSolutions = await this.createSolutions(
      this.currentSubProblemIndex!,
      textContexts.general,
      textContexts.scientific,
      textContexts.openData,
      textContexts.news,
      alreadyCreatedSolutionsText,
      "evolve-create-population"
    );

    return newSolutions;
  }

  selectParent(
    population: IEngineSolution[],
    excludedIndividual?: IEngineSolution
  ) {
    const tournamentSize =
      IEngineConstants.evolution.selectParentTournamentSize;

    let tournament = [];
    while (tournament.length < tournamentSize) {
      const randomIndex = Math.floor(Math.random() * population.length);
      if (excludedIndividual && population[randomIndex] === excludedIndividual)
        continue;
      tournament.push(population[randomIndex]);
    }

    tournament.sort((a, b) => b.eloRating! - a.eloRating!);
    return tournament[0];
  }

  getPreviousPopulation(subProblemIndex: number) {
    if (!this.memory.subProblems[subProblemIndex].solutions.populations) {
      this.memory.subProblems[subProblemIndex].solutions.populations = [];
    }

    if (
      this.memory.subProblems[subProblemIndex].solutions.populations.length > 0
    ) {
      return this.memory.subProblems[subProblemIndex].solutions.populations[0];
      return this.memory.subProblems[subProblemIndex].solutions.populations[
        this.memory.subProblems[subProblemIndex].solutions.populations.length -
          1
      ];
    } else {
      this.logger.error("No previous population found." + subProblemIndex);
      throw new Error("No previous population found." + subProblemIndex);
    }
  }

  async evolvePopulation() {
    for (
      let subProblemIndex = 0;
      subProblemIndex <
      Math.min(this.memory.subProblems.length, IEngineConstants.maxSubProblems);
      subProblemIndex++
    ) {
      this.currentSubProblemIndex = subProblemIndex;

      this.logger.info(`Evolve population for sub problem ${subProblemIndex}`);
      this.logger.info(
        `Current number of generations: ${this.memory.subProblems[subProblemIndex].solutions.populations.length}`
      );

      let previousPopulation = this.getPreviousPopulation(subProblemIndex);

      const populationSize = IEngineConstants.evolution.populationSize;
      const newPopulation = [];

      const eliteCount = Math.floor(
        previousPopulation.length * IEngineConstants.evolution.keepElitePercent
      );

      this.logger.debug(`Elite count: ${eliteCount}`);

      for (let i = 0; i < eliteCount; i++) {
        newPopulation.push(previousPopulation[i]);
        this.logger.debug(`Elite: ${previousPopulation[i].title}`);
      }

      // Mutation
      let mutationCount = Math.floor(
        populationSize * IEngineConstants.evolution.mutationOffspringPercent
      );

      if (newPopulation.length + mutationCount > populationSize) {
        mutationCount = populationSize - newPopulation.length;
      }

      this.logger.debug(`Mutation count: ${mutationCount}`);

      for (let i = 0; i < mutationCount; i++) {
        this.logger.debug(`Mutation ${i + 1} of ${mutationCount}`);
        const parent = this.selectParent(previousPopulation);
        this.logger.debug(`Parent: ${parent.title}`);
        try {
          const mutant = await this.mutate(parent);
          this.logger.debug(`Mutant: ${JSON.stringify(mutant, null, 2)}`);
          newPopulation.push(mutant);
          this.logger.debug("After mutant push");
        } catch (error) {
          this.logger.error("Error in mutation top");
          this.logger.error(error);
          throw error;
        }
      }

      // Crossover
      let crossoverCount = Math.floor(
        populationSize * IEngineConstants.evolution.crossoverPercent
      );

      this.logger.debug(`Crossover count: ${crossoverCount}`);

      for (let i = 0; i < crossoverCount; i++) {
        const parentA = this.selectParent(previousPopulation);
        const parentB = this.selectParent(previousPopulation, parentA);

        this.logger.debug(`Parent A: ${parentA.title}`);
        this.logger.debug(`Parent B: ${parentB.title}`);

        let offspring = await this.recombine(parentA, parentB);

        if (
          Math.random() < IEngineConstants.evolution.mutationOffspringPercent
        ) {
          offspring = await this.mutate(offspring);
        }

        this.logger.debug(`Offspring: ${JSON.stringify(offspring, null, 2)}`);

        newPopulation.push(offspring);
      }

      // Immigration
      let immigrationCount = Math.floor(
        populationSize * IEngineConstants.evolution.randomImmigrationPercent
      );

      this.logger.info(`Immigration count: ${immigrationCount}`);

      if (newPopulation.length + immigrationCount > populationSize) {
        immigrationCount = populationSize - newPopulation.length;
      }

      let newSolutions: IEngineSolution[] = [];

      this.logger.debug("Before creating new solutions");

      while (newSolutions.length < immigrationCount) {
        const currentSolutions = await this.getNewSolutions(newSolutions);
        this.logger.debug("After getting new solutions");

        newSolutions = [...newSolutions, ...currentSolutions];

        this.logger.debug(
          `New solutions for population: ${JSON.stringify(
            newSolutions,
            null,
            2
          )}`
        );
      }

      if (newSolutions.length > immigrationCount) {
        newSolutions.splice(immigrationCount);
      }

      this.logger.debug("After creating new solutions: " + newSolutions.length);

      newPopulation.push(...newSolutions);

      this.logger.info(
        `New population size: ${newPopulation.length} for sub problem ${subProblemIndex}`
      );

      this.memory.subProblems[subProblemIndex].solutions.populations.push(
        newPopulation
      );

      this.logger.debug(
        `Current number of generations after push: ${this.memory.subProblems[subProblemIndex].solutions.populations.length}`
      );

      await this.saveMemory();
    }
  }

  async process() {
    this.logger.info("Evolve Population Processor");

    try {
      await this.evolvePopulation();
    } catch (error: any) {
      this.logger.error("Error in Evolve Population Processor");
      this.logger.error(error);
      this.logger.error(error.stack);
      throw error;
    }
  }
}
