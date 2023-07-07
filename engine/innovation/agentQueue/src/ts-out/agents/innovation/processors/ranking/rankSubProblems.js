"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RankSubProblemsProcessor = void 0;
const openai_1 = require("langchain/chat_models/openai");
const schema_1 = require("langchain/schema");
const constants_js_1 = require("../../../../constants.js");
const basePairwiseRanking_js_1 = require("./basePairwiseRanking.js");
class RankSubProblemsProcessor extends basePairwiseRanking_js_1.BasePairwiseRankingsProcessor {
    subProblemIndex = 0;
    async voteOnPromptPair(promptPair) {
        const itemOneIndex = promptPair[0];
        const itemTwoIndex = promptPair[1];
        const itemOne = this.allItems[itemOneIndex];
        const itemTwo = this.allItems[itemTwoIndex];
        let itemOneTitle = itemOne.title;
        let itemOneDescription = itemOne.description;
        let itemTwoTitle = itemTwo.title;
        let itemTwoDescription = itemTwo.description;
        const messages = [
            new schema_1.SystemChatMessage(`
        You are an AI expert trained to analyse complex problem statements and associated sub-problems to determine their relevance.

        Please follow these guidelines:
        1. You will be presented with a problem statement and two associated sub-problems. These will be marked as "Sub Problem One" and "Sub Problem Two".
        2. Analyse, compare, and rank these two sub-problems in relation to the main problem statement to determine which is more relevant and important.
        3. Output your decision as either "One" or "Two". An explanation is not required.
        4. Ensure you take a methodical and step-by-step approach.
        `),
            new schema_1.HumanChatMessage(`
        ${this.renderProblemStatement()}

        Sub-Problems for Consideration:

        Sub Problem One:
        Title: ${itemOneTitle}
        Description: ${itemOneDescription}

        Sub Problem Two:
        Title: ${itemTwoTitle}
        Description: ${itemTwoDescription}

        The Most Relevant Sub-Problem Is:
        `),
        ];
        return await this.getResultsFromLLM("rank-sub-problems", constants_js_1.IEngineConstants.subProblemsRankingsModel, messages, itemOneIndex, itemTwoIndex);
    }
    async process() {
        this.logger.info("Rank Sub Problems Processor");
        super.process();
        this.chat = new openai_1.ChatOpenAI({
            temperature: constants_js_1.IEngineConstants.subProblemsRankingsModel.temperature,
            maxTokens: constants_js_1.IEngineConstants.subProblemsRankingsModel.maxOutputTokens,
            modelName: constants_js_1.IEngineConstants.subProblemsRankingsModel.name,
            verbose: constants_js_1.IEngineConstants.subProblemsRankingsModel.verbose,
        });
        this.setupRankingPrompts(this.memory.subProblems);
        await this.performPairwiseRanking();
        this.logger.debug(`Sub problems before ranking: ${JSON.stringify(this.memory.subProblems)}`);
        this.memory.subProblems = this.getOrderedListOfItems();
        this.logger.debug(`Sub problems after ranking: ${JSON.stringify(this.memory.subProblems)}`);
        await this.saveMemory();
    }
}
exports.RankSubProblemsProcessor = RankSubProblemsProcessor;
