import { BaseProcessor } from "../baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../../constants.js";

export class CreatePopulationProcessor extends BaseProcessor {
  async renderRecombinationPrompt(
    parentA: IEngineSolution,
    parentB: IEngineSolution
  ) {
    return [
      new SystemChatMessage(
        `
        As an AI expert, your task is to recombine the attributes of two parent solutions (Parent A and Parent B) to create a new offspring solution.

        Please recombine these solutions considering the following guidelines:
        1. The offspring should contain attributes from both parents.
        2. The recombination should be logical and meaningful.
        3. The offspring should be a viable solution to the problem.
        `
      ),
      new HumanChatMessage(
        `
        ${this.renderPromblemsWithIndexAndEntities(
          this.currentSubProblemIndex!
        )}

        Parent A:
        Title: ${parentA.title}
        Description: ${parentA.description}
        How Can Solution Help: ${parentA.howCanSolutionHelp}
        Main Obstacle to Solution Adoption: ${
          parentA.mainObstacleToSolutionAdoption
        }

        Parent B:
        Title: ${parentB.title}
        Description: ${parentB.description}
        How Can Solution Help: ${parentB.howCanSolutionHelp}
        Main Obstacle to Solution Adoption: ${
          parentB.mainObstacleToSolutionAdoption
        }

        Generate and output JSON for the offspring solution below:
        `
      ),
    ];
  }
  async renderMutatePrompt(individual: IEngineSolution) {
    return [
      new SystemChatMessage(
        `
        As an AI expert, your task is to mutate the following individual solution with a ${IEngineConstants.evolution.mutationPromptChangesRate} level of changes.

        Please consider the following guidelines:
        1. The mutation should introduce new attributes or alter existing ones.
        2. The mutation should be logical and meaningful.
        3. The mutated individual should still be a viable solution to the problem.
        `
      ),
      new HumanChatMessage(
        `
        ${this.renderPromblemsWithIndexAndEntities(
          this.currentSubProblemIndex!
        )}

        Individual to mutate:
        Title: ${individual.title}
        Description: ${individual.description}
        How Can Solution Help: ${individual.howCanSolutionHelp}
        Main Obstacle to Solution Adoption: ${
          individual.mainObstacleToSolutionAdoption
        }

        Generate and output JSON for the mutated solution below:
        `
      ),
    ];
  }
  async performRecombination(
    parentA: IEngineSolution,
    parentB: IEngineSolution
  ) {
    return (await this.callLLM(
      "evolve-mutate-population",
      IEngineConstants.evolutionMutateModel,
      await this.renderRecombinationPrompt(parentA, parentB)
    )) as IEngineSolution;
  }

  async recombine(parentA: IEngineSolution, parentB: IEngineSolution) {
    const offspring = await this.performRecombination(parentA, parentB);
    return offspring;
  }

  async performMutation(individual: IEngineSolution) {
    return (await this.callLLM(
      "evolve-mutate-population",
      IEngineConstants.evolutionMutateModel,
      await this.renderMutatePrompt(individual)
    )) as IEngineSolution;
  }

  async mutate(individual: IEngineSolution) {
    const mutant = await this.performMutation(individual);
    return mutant;
  }

  selectParent(population: any[]) {
    const tournamentSize =
      IEngineConstants.evolution.selectParentTournamentSize;

    let tournament = [];
    for (let i = 0; i < tournamentSize; i++) {
      const randomIndex = Math.floor(Math.random() * population.length);
      tournament.push(population[randomIndex]);
    }

    tournament.sort((a, b) => b.eloRanking - a.eloRanking);
    return tournament[0];
  }

  async createPopulation() {
    for (
      let subProblemIndex = 0;
      subProblemIndex <
      Math.min(this.memory.subProblems.length, IEngineConstants.maxSubProblems);
      subProblemIndex++
    ) {
      this.currentSubProblemIndex = subProblemIndex;

      let previousPopulation;

      if (
        this.memory.subProblems[subProblemIndex].solutions.populations.length >
        0
      ) {
        previousPopulation =
          this.memory.subProblems[subProblemIndex].solutions.populations[
            this.memory.subProblems[subProblemIndex].solutions.populations
              .length - 1
          ];
      } else {
        previousPopulation =
          this.memory.subProblems[subProblemIndex].solutions.seed;
      }

      const POPULATION_SIZE = 75;
      const newPopulation = [];

      const eliteCount = Math.floor(
        previousPopulation.length * IEngineConstants.evolution.keepElitePercent
      );

      for (let i = 0; i < eliteCount; i++) {
        newPopulation.push(previousPopulation[i]);
      }

      let mutationCount = Math.floor(
        (POPULATION_SIZE - newPopulation.length) *
          IEngineConstants.evolution.mutationRate
      );
      if (newPopulation.length + mutationCount > POPULATION_SIZE) {
        mutationCount = POPULATION_SIZE - newPopulation.length;
      }
      for (let i = 0; i < mutationCount; i++) {
        const parent = this.selectParent(previousPopulation);
        const mutant = await this.mutate(parent);
        newPopulation.push(mutant);
      }

      let crossoverCount = Math.floor(
        (POPULATION_SIZE - newPopulation.length) *
          IEngineConstants.evolution.crossoverPercent
      );
      if (newPopulation.length + crossoverCount > POPULATION_SIZE) {
        crossoverCount = POPULATION_SIZE - newPopulation.length;
      }
      for (let i = 0; i < crossoverCount; i++) {
        const parentA = this.selectParent(previousPopulation);
        const parentB = this.selectParent(previousPopulation);
        let offspring = await this.recombine(parentA, parentB);

        if (
          Math.random() < IEngineConstants.evolution.mutationOffspringPercent
        ) {
          offspring = await this.mutate(offspring);
        }

        newPopulation.push(offspring);
      }

      this.memory.subProblems[subProblemIndex].solutions.populations.push(
        newPopulation
      );
    }
  }

  async process() {
    this.logger.info("Create ProsCons Processor");
    super.process();

    this.chat = new ChatOpenAI({
      temperature: IEngineConstants.createProsConsModel.temperature,
      maxTokens: IEngineConstants.createProsConsModel.maxOutputTokens,
      modelName: IEngineConstants.createProsConsModel.name,
      verbose: IEngineConstants.createProsConsModel.verbose,
    });

    await this.createPopulation();
  }
}
