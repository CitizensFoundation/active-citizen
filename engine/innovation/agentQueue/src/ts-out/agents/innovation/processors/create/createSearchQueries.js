"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSearchQueriesProcessor = void 0;
const baseProcessor_js_1 = require("../baseProcessor.js");
const openai_1 = require("langchain/chat_models/openai");
const schema_1 = require("langchain/schema");
const constants_js_1 = require("../../../../constants.js");
class CreateSearchQueriesProcessor extends baseProcessor_js_1.BaseProcessor {
    //TODO: Maybe add a review and refine stage here as well
    renderCommonPromptSection() {
        return `
      3. Use your knowledge and experience to create the best possible search queries.
      4. Search queries should be concise, consistent, short, and succinct. They will be used to search on Google or Bing.
      5. You create four types of search queries:
      5.1 General
      5.2. Scientific
      5.3. OpenData
      5.4. News
      6. Create 10 search queries for each type.
      7. All search queries should be solution focused, let's find the solutions for those entities.
      8. Never output in markdown format.
      9. Provide an output in the following JSON format:
        { general: [ queries ], scientific: [ queries ], openData: [ queries ], news: [ queries ] }.
      10. Ensure a methodical, step-by-step approach to create the best possible search queries.
    `;
    }
    async renderProblemPrompt(problem) {
        return [
            new schema_1.SystemChatMessage(`
        You are an expert trained to analyse complex problem statements and create search queries to find solutions to those problems.

        Adhere to the following guidelines:
        1. You generate high quality search queries based on the problem statement.
        2. Always focus your search queries on the problem statement.
        ${this.renderCommonPromptSection()}    `),
            new schema_1.HumanChatMessage(`
         Problem Statement:
         ${problem}

         JSON Output:
       `),
        ];
    }
    async renderEntityPrompt(problem, entity) {
        return [
            new schema_1.SystemChatMessage(`
        You are an expert trained to analyse complex problem statements for affected entities and create search queries to find solutions for the affected entity.

        Adhere to the following guidelines:
        1. You generate high quality search queries based on the affected entity.
        2. Always focus your search queries on the Affected Entity not the problem statement.
        ${this.renderCommonPromptSection()}       `),
            new schema_1.HumanChatMessage(`
         Problem Statement:
         ${problem}

         Affected Entity:
         ${entity.name}
         ${this.renderEntityPosNegReasons(entity)}

         JSON Output:
       `),
        ];
    }
    async process() {
        this.logger.info("Create Search Queries Processor");
        super.process();
        this.chat = new openai_1.ChatOpenAI({
            temperature: constants_js_1.IEngineConstants.createSearchQueriesModel.temperature,
            maxTokens: constants_js_1.IEngineConstants.createSearchQueriesModel.maxOutputTokens,
            modelName: constants_js_1.IEngineConstants.createSearchQueriesModel.name,
            verbose: constants_js_1.IEngineConstants.createSearchQueriesModel.verbose,
        });
        this.memory.problemStatement.searchQueries = await this.callLLM("create-search-queries", constants_js_1.IEngineConstants.createSearchQueriesModel, await this.renderProblemPrompt(this.memory.problemStatement.description));
        await this.saveMemory();
        for (let s = 0; s <
            Math.min(this.memory.subProblems.length, constants_js_1.IEngineConstants.maxSubProblems); s++) {
            const promblemText = `
        ${this.memory.subProblems[s].title}
        ${this.memory.subProblems[s].description}
      `;
            this.memory.subProblems[s].searchQueries = await this.callLLM("create-search-queries", constants_js_1.IEngineConstants.createSearchQueriesModel, await this.renderProblemPrompt(promblemText));
            await this.saveMemory();
            for (let e = 0; e <
                Math.min(this.memory.subProblems[s].entities.length, constants_js_1.IEngineConstants.maxTopEntitiesToSearch); e++) {
                this.memory.subProblems[s].entities[e] = await this.callLLM("create-search-queries", constants_js_1.IEngineConstants.createSearchQueriesModel, await this.renderEntityPrompt(promblemText, this.memory.subProblems[s].entities[e]));
                await this.saveMemory();
            }
        }
    }
}
exports.CreateSearchQueriesProcessor = CreateSearchQueriesProcessor;
