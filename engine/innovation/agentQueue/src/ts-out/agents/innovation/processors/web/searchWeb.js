"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchWebProcessor = void 0;
const baseProcessor_js_1 = require("../baseProcessor.js");
const serpapi_1 = require("serpapi");
const constants_js_1 = require("../../../../constants.js");
const Redis = require("ioredis");
const redis = new Redis(process.env.REDIS_MEMORY_URL || undefined);
class SearchWebProcessor extends baseProcessor_js_1.BaseProcessor {
    async serpApiSearch(q, location = "New York, New York") {
        const redisKey = `s_web_v1:${q}`;
        const searchData = await redis.get(redisKey);
        if (searchData) {
            this.logger.debug(`Using cached search data for ${q}`);
            return searchData;
        }
        else {
            let retry = true;
            const maxRetries = constants_js_1.IEngineConstants.mainSearchRetryCount;
            let retryCount = 0;
            const params = {
                q,
                location,
                hl: "en",
                gl: "us",
                api_key: process.env.SERP_API_KEY,
            };
            let response;
            while (retry && retryCount < maxRetries) {
                try {
                    response = await (0, serpapi_1.getJson)("google", params);
                    retry = false;
                }
                catch (e) {
                    this.logger.error(e);
                    if (retryCount < maxRetries) {
                        retry = false;
                        throw e;
                    }
                    else {
                        await new Promise((resolve) => setTimeout(resolve, 3000));
                        retryCount++;
                    }
                }
            }
            if (response) {
                this.logger.debug(response);
                await redis.set(redisKey, JSON.stringify(searchData));
                return response;
            }
            else {
                throw new Error(`Failed to get search data for ${q}`);
            }
        }
    }
    async getQueryResults(queriesToSearch) {
        let searchResults = [];
        let knowledgeGraphResults = [];
        for (const query of queriesToSearch) {
            const generalSearchData = await this.serpApiSearch(query);
            searchResults = [
                ...searchResults,
                ...generalSearchData.organic_results,
            ];
            knowledgeGraphResults = [
                ...knowledgeGraphResults,
                ...generalSearchData.knowledge_graph,
            ];
        }
        return { searchResults, knowledgeGraphResults };
    }
    async processSubProblems(searchQueryType) {
        for (let s = 0; s <
            Math.min(this.memory.subProblems.length, constants_js_1.IEngineConstants.maxSubProblems); s++) {
            let queriesToSearch = this.memory.subProblems[s].searchQueries[searchQueryType].slice(0, constants_js_1.IEngineConstants.maxTopQueriesToSearchPerType);
            const results = await this.getQueryResults(queriesToSearch);
            this.memory.subProblems[s].searchResults.pages[searchQueryType] =
                results.searchResults;
            this.memory.subProblems[s].searchResults.knowledgeGraph[searchQueryType] =
                results.knowledgeGraphResults;
            await this.processEntities(s, searchQueryType);
            await this.saveMemory();
        }
    }
    async processEntities(subProblemIndex, searchQueryType) {
        for (let e = 0; e <
            Math.min(this.memory.subProblems[subProblemIndex].entities.length, constants_js_1.IEngineConstants.maxTopEntitiesToSearch); e++) {
            let queriesToSearch = this.memory.subProblems[subProblemIndex].entities[e].searchQueries[searchQueryType].slice(0, constants_js_1.IEngineConstants.maxTopQueriesToSearchPerType);
            const results = await this.getQueryResults(queriesToSearch);
            this.memory.subProblems[subProblemIndex].entities[e].searchResults.pages[searchQueryType] = results.searchResults;
            this.memory.subProblems[subProblemIndex].entities[e].searchResults.knowledgeGraph[searchQueryType] =
                results.knowledgeGraphResults;
        }
    }
    async processProblemStatement(searchQueryType) {
        let queriesToSearch = this.memory.problemStatement.searchQueries[searchQueryType].slice(0, constants_js_1.IEngineConstants.maxTopQueriesToSearchPerType);
        const results = await this.getQueryResults(queriesToSearch);
        this.memory.problemStatement.searchResults.pages[searchQueryType] = results.searchResults;
        this.memory.problemStatement.searchResults.knowledgeGraph[searchQueryType] = results.knowledgeGraphResults;
    }
    async process() {
        this.logger.info("Search Web Processor");
        super.process();
        for (const searchQueryType of [
            "general",
            "scientific",
            "openData",
            "news",
        ]) {
            await this.processProblemStatement(searchQueryType);
            await this.processSubProblems(searchQueryType);
        }
        await this.saveMemory();
    }
}
exports.SearchWebProcessor = SearchWebProcessor;
