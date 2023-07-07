import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";
import { IEngineConstants } from "../../../../constants.js";
import { CreateSolutionsProcessor } from "../create/createSolutions.js";
//TODO: Pentalty for similar ideas in the ranking somehow
//TODO: Track the evolution of the population with a log of parents and mutations, family tree
export class CreatePopulationProcessor extends CreateSolutionsProcessor {
    async renderRecombinationPrompt(parentA, parentB) {
        return [
            new SystemChatMessage(`
        As an AI genetic algorithm expert, your task is to recombine the attributes of two parent solutions (Parent A and Parent B) to create a new offspring solution.

        Please recombine these solutions considering the following guidelines:
        1. The offspring should contain attributes from both parents.
        2. The recombination should be logical and meaningful.
        3. The offspring should be a viable solution to the problem.
        `),
            new HumanChatMessage(`
        ${this.renderPromblemsWithIndexAndEntities(this.currentSubProblemIndex)}

        Parent A:
        ${JSON.stringify(parentA, null, 2)}

        Parent B:
        ${JSON.stringify(parentB, null, 2)}

        Generate and output JSON for the offspring solution below:
        `),
        ];
    }
    async renderMutatePrompt(individual) {
        return [
            new SystemChatMessage(`
        As an AI genetic algorithm expert, your task is to mutate the solution below.

        Please consider the following guidelines:
        1. Mutate the solution with a ${IEngineConstants.evolution.mutationPromptChangesRate} rate of changes.
        2. The mutation should introduce new attributes or alter existing ones.
        3. The mutation should be logical and meaningful.
        4. The mutated individual should still be a viable solution to the problem.
      `),
            new HumanChatMessage(`
        ${this.renderPromblemsWithIndexAndEntities(this.currentSubProblemIndex)}

        Solution to mutate:
        ${JSON.stringify(individual, null, 2)}

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
        return (await this.callLLM("evolve-recombine-population", IEngineConstants.evolutionRecombineModel, await this.renderRecombinationPrompt(parentA, parentB)));
    }
    async recombine(parentA, parentB) {
        const offspring = await this.performRecombination(parentA, parentB);
        return offspring;
    }
    async performMutation(individual) {
        this.chat = new ChatOpenAI({
            temperature: IEngineConstants.evolutionMutateModel.temperature,
            maxTokens: IEngineConstants.evolutionMutateModel.maxOutputTokens,
            modelName: IEngineConstants.evolutionMutateModel.name,
            verbose: IEngineConstants.evolutionMutateModel.verbose,
        });
        return (await this.callLLM("evolve-mutate-population", IEngineConstants.evolutionMutateModel, await this.renderMutatePrompt(individual)));
    }
    async mutate(individual) {
        const mutant = await this.performMutation(individual);
        return mutant;
    }
    async getNewSolutions(maxNumberOfSolution) {
        const textContexts = await this.getTextContext(this.currentSubProblemIndex, undefined);
        const newSolutions = await this.createSolutions(this.currentSubProblemIndex, textContexts.general, textContexts.scientific, textContexts.openData, textContexts.news, undefined);
        if (newSolutions.length > maxNumberOfSolution) {
            newSolutions.splice(0, newSolutions.length - maxNumberOfSolution, ...newSolutions.slice(0, maxNumberOfSolution));
        }
        return newSolutions;
    }
    selectParent(population) {
        const tournamentSize = IEngineConstants.evolution.selectParentTournamentSize;
        let tournament = [];
        for (let i = 0; i < tournamentSize; i++) {
            const randomIndex = Math.floor(Math.random() * population.length);
            tournament.push(population[randomIndex]);
        }
        tournament.sort((a, b) => b.eloRanking - a.eloRanking);
        return tournament[0];
    }
    getPreviousPopulation(subProblemIndex) {
        if (!this.memory.subProblems[subProblemIndex].solutions.populations) {
            this.memory.subProblems[subProblemIndex].solutions.populations = [];
        }
        if (this.memory.subProblems[subProblemIndex].solutions.populations.length > 0) {
            return this.memory.subProblems[subProblemIndex].solutions.populations[this.memory.subProblems[subProblemIndex].solutions.populations.length -
                1];
        }
        else {
            return this.memory.subProblems[subProblemIndex].solutions.seed;
        }
    }
    async createPopulation() {
        for (let subProblemIndex = 0; subProblemIndex <
            Math.min(this.memory.subProblems.length, IEngineConstants.maxSubProblems); subProblemIndex++) {
            this.currentSubProblemIndex = subProblemIndex;
            let previousPopulation = this.getPreviousPopulation(subProblemIndex);
            const POPULATION_SIZE = IEngineConstants.evolution.populationSize;
            const newPopulation = [];
            const eliteCount = Math.floor(previousPopulation.length * IEngineConstants.evolution.keepElitePercent);
            for (let i = 0; i < eliteCount; i++) {
                newPopulation.push(previousPopulation[i]);
            }
            // Mutation
            let mutationCount = Math.floor((POPULATION_SIZE - newPopulation.length) *
                IEngineConstants.evolution.mutationRate);
            if (newPopulation.length + mutationCount > POPULATION_SIZE) {
                mutationCount = POPULATION_SIZE - newPopulation.length;
            }
            for (let i = 0; i < mutationCount; i++) {
                const parent = this.selectParent(previousPopulation);
                const mutant = await this.mutate(parent);
                newPopulation.push(mutant);
            }
            // Crossover
            let crossoverCount = Math.floor((POPULATION_SIZE - newPopulation.length) *
                IEngineConstants.evolution.crossoverPercent);
            if (newPopulation.length + crossoverCount > POPULATION_SIZE) {
                crossoverCount = POPULATION_SIZE - newPopulation.length;
            }
            for (let i = 0; i < crossoverCount; i++) {
                const parentA = this.selectParent(previousPopulation);
                const parentB = this.selectParent(previousPopulation);
                let offspring = await this.recombine(parentA, parentB);
                if (Math.random() < IEngineConstants.evolution.mutationOffspringPercent) {
                    offspring = await this.mutate(offspring);
                }
                newPopulation.push(offspring);
            }
            // Immigration
            let immigrationCount = Math.floor((POPULATION_SIZE - newPopulation.length) *
                IEngineConstants.evolution.randomImmigrationPercent);
            if (newPopulation.length + immigrationCount > POPULATION_SIZE) {
                immigrationCount = POPULATION_SIZE - newPopulation.length;
            }
            let newSolutions = [];
            while (newSolutions.length < immigrationCount) {
                newSolutions = [
                    ...newSolutions,
                    ...(await this.getNewSolutions(immigrationCount)),
                ];
            }
            newPopulation.push(...newSolutions);
            this.memory.subProblems[subProblemIndex].solutions.populations.push(newPopulation);
        }
    }
    async process() {
        this.logger.info("Evolve Population Processor");
        super.process();
        await this.createPopulation();
    }
}
