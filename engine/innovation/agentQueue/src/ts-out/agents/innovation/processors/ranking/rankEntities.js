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
        let itemOneTitle = itemOne.name;
        let itemOneEffects = this.renderEntityPosNegReasons(itemOne);
        let itemTwoTitle = itemTwo.name;
        let itemTwoEffects = this.renderEntityPosNegReasons(itemTwo);
        const messages = [
            new schema_1.SystemChatMessage(`
        You are an AI expert specializing in analyzing complex problem statements, sub-problems, and ranking affected entities. Please adhere to the following guidelines:

        1. You will be provided with a problem statement followed by a sub-problem.
        2. Two entities affected by the sub-problem will be given, labelled as "Entity One" and "Entity Two".
        3. Analyze and compare the entities, and then decide which one is more significantly impacted.
        4. Consider both positive and negative impacts, if available, while ranking.
        5. Output your decision as either "One" or "Two", indicating the more affected entity. No need for any explanations.
        6. Ensure to use a systematic and step-by-step approach. Think step by step.`),
            new schema_1.HumanChatMessage(`
         ${this.renderProblemStatement()}

         ${this.renderSubProblem(this.currentSubProblemIndex)}

         Entities for Ranking:

         Entity One:
         ${itemOneTitle}
         ${itemOneEffects}

         Entity Two:
         ${itemTwoTitle}
         ${itemTwoEffects}

         The More Affected Entity Is:
       `),
        ];
        return await this.getResultsFromLLM("rank-entities", constants_js_1.IEngineConstants.entitiesRankingsModel, messages, itemOneIndex, itemTwoIndex);
    }
    async process() {
        this.logger.info("Rank Entities Processor");
        super.process();
        this.chat = new openai_1.ChatOpenAI({
            temperature: constants_js_1.IEngineConstants.entitiesRankingsModel.temperature,
            maxTokens: constants_js_1.IEngineConstants.entitiesRankingsModel.maxOutputTokens,
            modelName: constants_js_1.IEngineConstants.entitiesRankingsModel.name,
            verbose: constants_js_1.IEngineConstants.entitiesRankingsModel.verbose,
        });
        this.currentSubProblemIndex = 0;
        for (let s = 0; s <
            Math.min(this.memory.subProblems.length, constants_js_1.IEngineConstants.maxSubProblems); s++) {
            const filteredEntities = this.memory.subProblems[s].entities.filter((entity) => {
                return ((entity.positiveEffects && entity.positiveEffects.length > 0) ||
                    (entity.negativeEffects && entity.negativeEffects.length > 0));
            });
            this.setupRankingPrompts(filteredEntities);
            await this.performPairwiseRanking();
            this.memory.subProblems[s].entities =
                this.getOrderedListOfItems();
            await this.saveMemory();
            this.currentSubProblemIndex++;
        }
    }
}
exports.RankSubProblemsProcessor = RankSubProblemsProcessor;
