"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RankSearchResultsProcessor = void 0;
const openai_1 = require("langchain/chat_models/openai");
const schema_1 = require("langchain/schema");
const constants_js_1 = require("../../../../constants.js");
const basePairwiseRanking_js_1 = require("./basePairwiseRanking.js");
class RankSearchResultsProcessor extends basePairwiseRanking_js_1.BasePairwiseRankingsProcessor {
    subProblemIndex = 0;
    entitiesIndex = 0;
    currentEntity;
    searchResultType;
    searchResultTarget;
    renderProblemDetail() {
        let detail = ``;
        if (this.searchResultTarget === "problemStatement") {
            detail = `
        ${this.renderProblemStatement()}
      `;
        }
        else if (this.searchResultTarget === "subProblem") {
            detail = `
        ${this.renderPromblemsWithIndexAndEntities(this.subProblemIndex)}
      `;
        }
        else if (this.searchResultTarget === "entity") {
            detail = `
        ${this.renderProblemStatement()}

        ${this.renderSubProblem(this.currentSubProblemIndex)}

        Entity:
        ${this.currentEntity.name}
        ${this.renderEntityPosNegReasons(this.currentEntity)}
      `;
        }
        return detail;
    }
    async voteOnPromptPair(promptPair) {
        const itemOneIndex = promptPair[0];
        const itemTwoIndex = promptPair[1];
        const itemOne = this.allItems[itemOneIndex];
        const itemTwo = this.allItems[itemTwoIndex];
        let itemOneTitle = itemOne.title;
        let itemOneDescription = itemOne.snippet;
        let itemTwoTitle = itemTwo.title;
        let itemTwoDescription = itemTwo.snippet;
        const messages = [
            new schema_1.SystemChatMessage(`
        You are an AI expert, trained to rank search results pertaining to complex problem statements and sub-problems.

        Please adhere to these guidelines:
        1. You will be presented with a problem statement or sub-problem, possibly including entities affected by the problem in either positive or negative ways.
        2. You will also receive two web links, each accompanied by a title and description, marked as "Search Result One" and "Search Result Two".
        3. Your task is to analyze, compare, and rank these search results based on their relevance to the provided problem statement or sub-problem.
        4. Output your decision as either "One" or "Two". No explanation is required.
        5. Ensure your approach is methodical and systematic. Think step by step.`),
            new schema_1.HumanChatMessage(`
        Search Result Type: ${this.searchResultType}

        ${this.renderProblemDetail()}

        Search Results to Rank:

        Search Result One:
        ${itemOneTitle}
        ${itemOneDescription}

        Search Result Two:
        ${itemTwoTitle}
        ${itemTwoDescription}

        The Most Relevant Search Result Is:
       `),
        ];
        return await this.getResultsFromLLM("rank-search-results", constants_js_1.IEngineConstants.searchResultsRankingsModel, messages, itemOneIndex, itemTwoIndex);
    }
    async processSubProblems(searchResultType) {
        for (let s = 0; s <
            Math.min(this.memory.subProblems.length, constants_js_1.IEngineConstants.maxSubProblems); s++) {
            let resultsToRank = this.memory.subProblems[s].searchResults.pages[searchResultType];
            this.subProblemIndex = s;
            this.searchResultTarget = "subProblem";
            this.setupRankingPrompts(resultsToRank);
            await this.performPairwiseRanking();
            this.memory.subProblems[s].searchResults.pages[searchResultType] =
                this.getOrderedListOfItems();
            this.searchResultTarget = "entity";
            await this.processEntities(s, searchResultType);
            await this.saveMemory();
        }
    }
    async processEntities(subProblemIndex, searchResultType) {
        for (let e = 0; e <
            Math.min(this.memory.subProblems[subProblemIndex].entities.length, constants_js_1.IEngineConstants.maxTopEntitiesToSearch); e++) {
            this.currentEntity = this.memory.subProblems[subProblemIndex].entities[e];
            let resultsToRank = this.memory.subProblems[subProblemIndex].entities[e].searchResults.pages[searchResultType];
            this.setupRankingPrompts(resultsToRank);
            await this.performPairwiseRanking();
            this.memory.subProblems[subProblemIndex].entities[e].searchResults.pages[searchResultType] =
                this.getOrderedListOfItems();
        }
    }
    async process() {
        this.logger.info("Rank Search Results Processor");
        super.process();
        this.chat = new openai_1.ChatOpenAI({
            temperature: constants_js_1.IEngineConstants.searchResultsRankingsModel.temperature,
            maxTokens: constants_js_1.IEngineConstants.searchQueryRankingsModel.maxOutputTokens,
            modelName: constants_js_1.IEngineConstants.searchQueryRankingsModel.name,
            verbose: constants_js_1.IEngineConstants.searchQueryRankingsModel.verbose,
        });
        for (const searchResultType of [
            "general",
            "scientific",
            "openData",
            "news",
        ]) {
            let resultsToRank = this.memory.problemStatement.searchResults.pages[searchResultType];
            this.searchResultTarget = "problemStatement";
            this.setupRankingPrompts(resultsToRank);
            await this.performPairwiseRanking();
            this.memory.problemStatement.searchResults.pages[searchResultType] = this.getOrderedListOfItems();
            this.searchResultType = searchResultType;
            this.processSubProblems(searchResultType);
        }
        await this.saveMemory();
    }
}
exports.RankSearchResultsProcessor = RankSearchResultsProcessor;
