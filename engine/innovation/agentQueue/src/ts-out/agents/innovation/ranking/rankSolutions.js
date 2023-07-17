import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";
import { IEngineConstants } from "../../../constants.js";
import { BasePairwiseRankingsProcessor } from "./basePairwiseRanking.js";
export class RankSolutionsProcessor extends BasePairwiseRankingsProcessor {
    subProblemIndex = 0;
    getProCons(prosCons) {
        if (prosCons && prosCons.length > 0) {
            return prosCons.map((proCon) => proCon.description);
        }
        else {
            return [];
        }
    }
    async voteOnPromptPair(promptPair) {
        const itemOneIndex = promptPair[0];
        const itemTwoIndex = promptPair[1];
        const solutionOne = this.allItems[itemOneIndex];
        const solutionTwo = this.allItems[itemTwoIndex];
        const messages = [
            new SystemChatMessage(`
        As an AI expert, your role involves analyzing solutions to complex problem statements and sub-problems.

        Please adhere to the following guidelines:
        1. You will be presented with a problem statement and two corresponding solutions. These will be labelled "Solution One" and "Solution Two".
        2. Analyze, compare, and rank these solutions based on their relevance and importance to the problem statement.
        3. Consider the pros and cons of each solution while ranking.
        4. Consider the entities affected by the problem statement and sub-problem, if available, while ranking.
        5. Output your decision as either "One" or "Two". No explanation is necessary.
        6. Ensure your approach is methodical and systematic. Think step by step.
        `),
            new HumanChatMessage(`
        ${this.renderPromblemsWithIndexAndEntities(this.subProblemIndex)}

        Solutions for Consideration:

        Solution One:
        ----------------------------------------
        ${solutionOne.title}
        ${solutionOne.description}

        Pros of Solution One:
        ${this.getProCons(solutionOne.pros).slice(0, IEngineConstants.maxTopProsConsUsedForRanking)}

        Cons of Solution One:
        ${this.getProCons(solutionOne.cons).slice(0, IEngineConstants.maxTopProsConsUsedForRanking)}

        Solution Two:
        ----------------------------------------
        ${solutionTwo.title}
        ${solutionTwo.description}

        Pros of Solution Two:
        ${this.getProCons(solutionTwo.pros).slice(0, IEngineConstants.maxTopProsConsUsedForRanking).map}

        Cons of Solution Two:
        ${this.getProCons(solutionTwo.cons).slice(0, IEngineConstants.maxTopProsConsUsedForRanking)}

        The More Important Solution Is:
        `),
        ];
        return await this.getResultsFromLLM("rank-solutions", IEngineConstants.solutionsRankingsModel, messages, itemOneIndex, itemTwoIndex);
    }
    async process() {
        this.logger.info("Rank Solutions Processor");
        super.process();
        try {
            this.chat = new ChatOpenAI({
                temperature: IEngineConstants.solutionsRankingsModel.temperature,
                maxTokens: IEngineConstants.solutionsRankingsModel.maxOutputTokens,
                modelName: IEngineConstants.solutionsRankingsModel.name,
                verbose: IEngineConstants.solutionsRankingsModel.verbose,
            });
            for (let s = 0; s <
                Math.min(this.memory.subProblems.length, IEngineConstants.maxSubProblems); s++) {
                this.subProblemIndex = s;
                if (this.memory.subProblems[s].solutions.populations &&
                    this.memory.subProblems[s].solutions.populations.length > 0 &&
                    this.memory.subProblems[s].solutions.populations[0].length > 0) {
                    this.setupRankingPrompts(this.memory.subProblems[s].solutions.populations[this.memory.subProblems[s].solutions.populations.length - 1]);
                    await this.performPairwiseRanking();
                    this.logger.debug(`Population Solutions before ranking: ${JSON.stringify(this.memory.subProblems[s].solutions.populations[this.memory.subProblems[s].solutions.populations.length - 1])}`);
                    this.memory.subProblems[s].solutions.populations[this.memory.subProblems[s].solutions.populations.length - 1] = this.getOrderedListOfItems(true);
                    this.logger.debug(`Popuplation Solutions after ranking: ${JSON.stringify(this.memory.subProblems[s].solutions.populations[this.memory.subProblems[s].solutions.populations.length - 1])}`);
                }
                else {
                    this.setupRankingPrompts(this.memory.subProblems[s].solutions.seed);
                    await this.performPairwiseRanking();
                    this.logger.debug(`Seed Solutions before ranking: ${JSON.stringify(this.memory.subProblems[s].solutions.seed)}`);
                    this.memory.subProblems[s].solutions.seed =
                        this.getOrderedListOfItems(true);
                    this.logger.debug(`Seed Solutions after ranking: ${JSON.stringify(this.memory.subProblems[s].solutions.seed)}`);
                }
                await this.saveMemory();
            }
        }
        catch (error) {
            this.logger.error(error);
            throw error;
        }
    }
}
