import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";
import { IEngineConstants } from "../../../constants.js";
import { CreateSolutionsProcessor } from "../create/createSolutions.js";
//TODO: Pentalty for similar ideas in the ranking somehow
//TODO: Track the evolution of the population with a log of parents and mutations, family tree
export class EvolvePopulationProcessor extends CreateSolutionsProcessor {
    renderSolution(solution) {
        return JSON.stringify({
            title: solution.title,
            description: solution.description,
            mainBenefitOfSolution: solution.mainBenefitOfSolution,
            mainObstacleToSolutionAdoption: solution.mainObstacleToSolutionAdoption,
        }, null, 2);
    }
    renderRecombinationPrompt(parentA, parentB) {
        return [
            new SystemChatMessage(`
        As an AI genetic algorithm expert, your task is to recombine the attributes of two parent solutions (Parent A and Parent B) to create a new offspring solution.

        Please recombine these solutions considering the following guidelines:
        1. The offspring should contain attributes from both parents.
        2. The recombination should be logical and meaningful.
        3. The offspring should be a viable solution to the problem.
        5. Output your recombined solution in the following JSON format: { title, description, mainBenefitOfSolution, mainObstacleToSolutionAdoption }.
        6. Never add JSON properties, only change existing ones.
        7. Think step by step.
        `),
            new HumanChatMessage(`
        ${this.renderProblemStatementSubProblemsAndEntities(this.currentSubProblemIndex)}

        Parent A:
        ${this.renderSolution(parentA)}

        Parent B:
        ${this.renderSolution(parentB)}

        Generate and output JSON for the offspring solution below:
        `),
        ];
    }
    renderMutatePrompt(individual) {
        return [
            new SystemChatMessage(`
        As an AI genetic algorithm expert, your task is to mutate the solution below.

        Please consider the following guidelines:
        1. Mutate the solution with a ${IEngineConstants.evolution.mutationPromptChangesRate} rate of changes.
        2. The mutation should introduce new attributes or alter existing ones.
        3. The mutation should be logical and meaningful.
        4. The mutated individual should still be a viable solution to the problem.
        5. Output your mutated solution in the following JSON format: { title, description, mainBenefitOfSolution, mainObstacleToSolutionAdoption }.
        6. Never add JSON properties, only change existing ones.
        7. Think step by step.

      `),
            new HumanChatMessage(`
        ${this.renderProblemStatementSubProblemsAndEntities(this.currentSubProblemIndex)}

        Solution to mutate:
        ${this.renderSolution(individual)}

        Generate and output JSON for the mutated solution below:
        `),
        ];
    }
    async performRecombination(parentA, parentB) {
        this.chat = new ChatOpenAI({
            temperature: IEngineConstants.evolutionRecombineModel.temperature,
            maxTokens: IEngineConstants.evolutionRecombineModel.maxOutputTokens,
            modelName: IEngineConstants.evolutionRecombineModel.name,
            verbose: IEngineConstants.evolutionRecombineModel.verbose,
        });
        return (await this.callLLM("evolve-recombine-population", IEngineConstants.evolutionRecombineModel, this.renderRecombinationPrompt(parentA, parentB)));
    }
    async recombine(parentA, parentB) {
        const offspring = await this.performRecombination(parentA, parentB);
        return offspring;
    }
    async performMutation(individual) {
        this.logger.debug("Performing mutation");
        this.chat = new ChatOpenAI({
            temperature: IEngineConstants.evolutionMutateModel.temperature,
            maxTokens: IEngineConstants.evolutionMutateModel.maxOutputTokens,
            modelName: IEngineConstants.evolutionMutateModel.name,
            verbose: IEngineConstants.evolutionMutateModel.verbose,
        });
        this.logger.debug("Before mutation");
        try {
            const mutant = (await this.callLLM("evolve-mutate-population", IEngineConstants.evolutionMutateModel, this.renderMutatePrompt(individual)));
            this.logger.debug("After mutation");
            return mutant;
        }
        catch (error) {
            this.logger.error("Error in mutation");
            this.logger.error(error);
            throw error;
        }
    }
    async mutate(individual) {
        try {
            const mutant = await this.performMutation(individual);
            return mutant;
        }
        catch (error) {
            this.logger.error("Error in mutate");
            this.logger.error(error);
            throw error;
        }
    }
    async getNewSolutions(alreadyCreatedSolutions) {
        this.logger.info(`Getting new solutions`);
        this.chat = new ChatOpenAI({
            temperature: IEngineConstants.createSolutionsModel.temperature,
            maxTokens: IEngineConstants.createSolutionsModel.maxOutputTokens,
            modelName: IEngineConstants.createSolutionsModel.name,
            verbose: IEngineConstants.createSolutionsModel.verbose,
        });
        let alreadyCreatedSolutionsText;
        if (alreadyCreatedSolutions.length > 0) {
            alreadyCreatedSolutionsText = alreadyCreatedSolutions
                .map((solution) => solution.title)
                .join("\n");
        }
        const textContexts = await this.getTextContext(this.currentSubProblemIndex, alreadyCreatedSolutionsText);
        this.logger.debug(`Evolution Text contexts: ${JSON.stringify(textContexts, null, 2)}`);
        const newSolutions = await this.createSolutions(this.currentSubProblemIndex, textContexts.general, textContexts.scientific, textContexts.openData, textContexts.news, alreadyCreatedSolutionsText);
        return newSolutions;
    }
    selectParent(population) {
        const tournamentSize = IEngineConstants.evolution.selectParentTournamentSize;
        let tournament = [];
        for (let i = 0; i < tournamentSize; i++) {
            const randomIndex = Math.floor(Math.random() * population.length);
            tournament.push(population[randomIndex]);
        }
        tournament.sort((a, b) => b.eloRating - a.eloRating);
        return tournament[0];
    }
    getPreviousPopulation(subProblemIndex) {
        if (!this.memory.subProblems[subProblemIndex].solutions.populations) {
            this.memory.subProblems[subProblemIndex].solutions.populations = [];
        }
        if (this.memory.subProblems[subProblemIndex].solutions.populations.length > 0) {
            return this.memory.subProblems[subProblemIndex].solutions.populations[0];
            return this.memory.subProblems[subProblemIndex].solutions.populations[this.memory.subProblems[subProblemIndex].solutions.populations.length -
                1];
        }
        else {
            this.logger.error("No previous population found." + subProblemIndex);
            throw new Error("No previous population found." + subProblemIndex);
        }
    }
    async createPopulation() {
        for (let subProblemIndex = 0; subProblemIndex <
            Math.min(this.memory.subProblems.length, IEngineConstants.maxSubProblems); subProblemIndex++) {
            this.currentSubProblemIndex = subProblemIndex;
            let previousPopulation = this.getPreviousPopulation(subProblemIndex);
            const populationSize = IEngineConstants.evolution.populationSize;
            const newPopulation = [];
            const eliteCount = Math.floor(previousPopulation.length * IEngineConstants.evolution.keepElitePercent);
            this.logger.debug(`Elite count: ${eliteCount}`);
            for (let i = 0; i < eliteCount; i++) {
                newPopulation.push(previousPopulation[i]);
                this.logger.debug(`Elite: ${previousPopulation[i].title}`);
            }
            // Immigration
            let immigrationCount = Math.floor(populationSize * IEngineConstants.evolution.randomImmigrationPercent);
            this.logger.info(`Immigration count: ${immigrationCount}`);
            if (newPopulation.length + immigrationCount > populationSize) {
                immigrationCount = populationSize - newPopulation.length;
            }
            let newSolutions = [];
            this.logger.debug("Before creating new solutions");
            while (newSolutions.length < immigrationCount) {
                const currentSolutions = await this.getNewSolutions(newSolutions);
                this.logger.debug("After getting new solutions");
                newSolutions = [...newSolutions, ...currentSolutions];
                this.logger.debug(`New solutions for population: ${JSON.stringify(newSolutions, null, 2)}`);
            }
            if (newSolutions.length > immigrationCount) {
                newSolutions.splice(0, newSolutions.length - immigrationCount, ...newSolutions.slice(0, immigrationCount));
            }
            this.logger.debug("After creating new solutions: " + newSolutions.length);
            newPopulation.push(...newSolutions);
            // Crossover
            let crossoverCount = Math.floor(populationSize * IEngineConstants.evolution.crossoverPercent);
            this.logger.debug(`Crossover count: ${crossoverCount}`);
            for (let i = 0; i < crossoverCount; i++) {
                const parentA = this.selectParent(previousPopulation);
                const parentB = this.selectParent(previousPopulation);
                this.logger.debug(`Parent A: ${parentA.title}`);
                this.logger.debug(`Parent B: ${parentB.title}`);
                let offspring = await this.recombine(parentA, parentB);
                if (Math.random() < IEngineConstants.evolution.mutationOffspringPercent) {
                    offspring = await this.mutate(offspring);
                }
                this.logger.debug(`Offspring: ${JSON.stringify(offspring, null, 2)}`);
                newPopulation.push(offspring);
            }
            // Mutation
            let mutationCount = Math.floor(populationSize * IEngineConstants.evolution.mutationOffspringPercent);
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
                }
                catch (error) {
                    this.logger.error("Error in mutation top");
                    this.logger.error(error);
                    throw error;
                }
            }
            this.memory.subProblems[subProblemIndex].solutions.populations.push(newPopulation);
            await this.saveMemory();
        }
    }
    async process() {
        this.logger.info("Evolve Population Processor");
        try {
            await this.createPopulation();
        }
        catch (error) {
            this.logger.error("Error in Evolve Population Processor");
            this.logger.error(error);
            this.logger.error(error.stack);
            throw error;
        }
    }
}
