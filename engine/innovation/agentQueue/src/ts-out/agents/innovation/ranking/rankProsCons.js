import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";
import { IEngineConstants } from "../../../constants.js";
import { BasePairwiseRankingsProcessor } from "./basePairwiseRanking.js";
export class RankProsConsProcessor extends BasePairwiseRankingsProcessor {
    async voteOnPromptPair(promptPair, additionalData) {
        const itemOneIndex = promptPair[0];
        const itemTwoIndex = promptPair[1];
        const prosOrConsOne = this.allItems[itemOneIndex]
            .description;
        const prosOrConsTwo = this.allItems[itemTwoIndex]
            .description;
        let proConSingle;
        if (additionalData.prosOrCons === "pros") {
            proConSingle = "Pro";
        }
        else {
            proConSingle = "Con";
        }
        const messages = [
            new SystemChatMessage(`
        As an AI expert, your role involves analyzing ${additionalData.prosOrCons} associated with solutions to problem statements and sub-problems to decide on which ${additionalData.prosOrCons} is more important.

        Please adhere to the following guidelines:

        1. You will be presented with a problem statement, a solution, and two ${additionalData.prosOrCons}. These will be labeled as "${proConSingle} One" and "${proConSingle} Two".
        2. Analyze and compare the ${additionalData.prosOrCons} based on their relevance and importance to the solution and choose which is more important and output your decision as either "One" or "Two".
        3. Never explain your reasoning.
        `),
            new HumanChatMessage(`
        ${this.renderProblemStatement()}

        ${this.renderSubProblem(additionalData.subProblemIndex)}

        ${additionalData.solution}

        Which ${proConSingle} is more important regarding the solution above? Output your decision as either "One" or "Two".

        ${proConSingle} One: ${prosOrConsOne}

        ${proConSingle} Two: ${prosOrConsTwo}

        The more important ${proConSingle} is:
        `),
        ];
        return await this.getResultsFromLLM("rank-pros-cons", IEngineConstants.prosConsRankingsModel, messages, itemOneIndex, itemTwoIndex);
    }
    convertProsConsToObjects(prosCons) {
        return prosCons.map((prosCon) => {
            return {
                description: prosCon,
            };
        });
    }
    async process() {
        this.logger.info("Rank Pros Cons Processor");
        super.process();
        this.chat = new ChatOpenAI({
            temperature: IEngineConstants.prosConsRankingsModel.temperature,
            maxTokens: IEngineConstants.prosConsRankingsModel.maxOutputTokens,
            modelName: IEngineConstants.prosConsRankingsModel.name,
            verbose: IEngineConstants.prosConsRankingsModel.verbose,
        });
        try {
            // Parallel execution of the subproblems
            const subProblemPromises = this.memory.subProblems.map((subProblem, subProblemIndex) => {
                return this.processSubProblem(subProblem, subProblemIndex);
            });
            await Promise.all(subProblemPromises);
        }
        catch (error) {
            this.logger.error("Error in Rank Pros Cons Processor");
            this.logger.error(error);
        }
    }
    async processSubProblem(subProblem, subProblemIndex) {
        this.logger.info(`Ranking pros/cons for sub problem ${subProblemIndex}`);
        let solutions = subProblem.solutions.populations[this.currentPopulationIndex(subProblemIndex)];
        for (let solutionIndex = 0; solutionIndex < solutions.length; solutionIndex++) {
            const solution = solutions[solutionIndex];
            const solutionDescription = this.renderSolution(solution);
            for (const prosOrCons of ["pros", "cons"]) {
                if (solution[prosOrCons] && solution[prosOrCons].length > 0) {
                    const firstItem = solution[prosOrCons][0];
                    const hasStrings = typeof firstItem === "string";
                    // Only rank if the pros/cons are strings from the creation step
                    if (hasStrings) {
                        this.logger.debug(`${prosOrCons} before ranking: ${JSON.stringify(solution[prosOrCons], null, 2)}`);
                        this.logger.debug("Converting pros/cons to objects");
                        const convertedProsCons = this.convertProsConsToObjects(solution[prosOrCons]);
                        this.setupRankingPrompts(convertedProsCons);
                        await this.performPairwiseRanking({
                            solution: solutionDescription,
                            prosOrCons,
                            subProblemIndex
                        });
                        subProblem.solutions.populations[this.currentPopulationIndex(subProblemIndex)][solutionIndex][prosOrCons] = this.getOrderedListOfItems(true);
                        this.logger.debug(`${prosOrCons} before ranking: ${JSON.stringify(subProblem.solutions.populations[this.currentPopulationIndex(subProblemIndex)][solutionIndex][prosOrCons], null, 2)}`);
                    }
                }
                else {
                    this.logger.error(`No ${prosOrCons} to rank`);
                }
            }
            await this.saveMemory();
        }
    }
    renderSolution(solution) {
        return `
      Solution:
      ${solution.title}
      ${solution.description}
    `;
    }
}
