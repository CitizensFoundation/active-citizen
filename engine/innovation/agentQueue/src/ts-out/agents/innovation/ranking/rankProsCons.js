import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";
import { IEngineConstants } from "../../../constants.js";
import { BasePairwiseRankingsProcessor } from "./basePairwiseRanking.js";
export class RankProsConsProcessor extends BasePairwiseRankingsProcessor {
    subProblemIndex = 0;
    currentSolutionIndex = 0;
    currentProsOrCons;
    renderCurrentSolution() {
        const solution = this.memory.subProblems[this.currentSubProblemIndex].solutions.seed[this.currentSolutionIndex];
        return `
      Solution:

      Title: ${solution.title}
      Description: ${solution.description}

      How Solution One Can Help: ${solution.mainBenefitOfSolution}
      Main Obstacles to Solution One Adoption: ${solution.mainObstacleToSolutionAdoption}
    `;
    }
    async voteOnPromptPair(promptPair) {
        const itemOneIndex = promptPair[0];
        const itemTwoIndex = promptPair[1];
        const prosOrConsOne = this.allItems[itemOneIndex];
        const prosOrConsTwo = this.allItems[itemTwoIndex];
        const messages = [
            new SystemChatMessage(`
        As an AI expert, your role involves analyzing ${this.currentProsOrCons} associated with solutions to complex problem statements and sub-problems.

        Please adhere to the following guidelines:

        1. You will be presented with a problem statement, a solution, and two ${this.currentProsOrCons}. These will be labeled as "${this.currentProsOrCons.toUpperCase()} One" and "${this.currentProsOrCons.toUpperCase()} Two".
        2. Analyze, compare, and rank these ${this.currentProsOrCons} based on their relevance and importance to the solution and problem statement.
        3. Consider the entities affected by the solution, if available, while ranking.
        4. Output your decision as either "One" or "Two". No explanation is necessary.
        5. Ensure your approach is methodical and systematic. Engage in step-by-step thinking.
        `),
            new HumanChatMessage(`
        ${this.renderPromblemsWithIndexAndEntities(this.subProblemIndex)}

        ${this.renderCurrentSolution()}

        ${this.currentProsOrCons.toUpperCase()} One:
        ${prosOrConsOne}

        ${this.currentProsOrCons.toUpperCase()} Two:
        ${prosOrConsTwo}

        Please Identify the Best ${this.currentProsOrCons.toUpperCase()}:
        `),
        ];
        return await this.getResultsFromLLM("rank-pros-cons", IEngineConstants.prosConsRankingsModel, messages, itemOneIndex, itemTwoIndex);
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
        for (let subProblemIndex = 0; subProblemIndex <
            Math.min(this.memory.subProblems.length, IEngineConstants.maxSubProblems); subProblemIndex++) {
            this.subProblemIndex = subProblemIndex;
            let solutions;
            if (this.memory.subProblems[subProblemIndex].solutions.populations &&
                this.memory.subProblems[subProblemIndex].solutions.populations.length >
                    0 &&
                this.memory.subProblems[subProblemIndex].solutions.populations[0]
                    .length > 0) {
                solutions =
                    this.memory.subProblems[subProblemIndex].solutions.populations[this.memory.subProblems[subProblemIndex].solutions.populations
                        .length - 1];
            }
            else {
                solutions = this.memory.subProblems[subProblemIndex].solutions.seed;
            }
            for (let solutionIndex = 0; solutionIndex < solutions.length; solutionIndex++) {
                this.currentSolutionIndex = solutionIndex;
                for (const prosOrCons of ["pros", "cons"]) {
                    this.currentProsOrCons = prosOrCons;
                    this.setupRankingPrompts(solutions[solutionIndex][prosOrCons]);
                    await this.performPairwiseRanking();
                    this.logger.debug(`${prosOrCons} before ranking: ${JSON.stringify(solutions[solutionIndex][prosOrCons])}`);
                    if (this.memory.subProblems[subProblemIndex].solutions.populations &&
                        this.memory.subProblems[subProblemIndex].solutions.populations
                            .length > 0 &&
                        this.memory.subProblems[subProblemIndex].solutions.populations[0]
                            .length > 0) {
                        this.memory.subProblems[subProblemIndex].solutions.populations[this.memory.subProblems[subProblemIndex].solutions.populations
                            .length - 1][solutionIndex][prosOrCons] =
                            this.getOrderedListOfItems();
                    }
                    else {
                        this.memory.subProblems[subProblemIndex].solutions.seed[solutionIndex][prosOrCons] = this.getOrderedListOfItems();
                        this.logger.debug(`${prosOrCons} after ranking: ${JSON.stringify(this.memory.subProblems[subProblemIndex].solutions.seed[solutionIndex][prosOrCons])}`);
                    }
                    await this.saveMemory();
                }
            }
        }
    }
}
