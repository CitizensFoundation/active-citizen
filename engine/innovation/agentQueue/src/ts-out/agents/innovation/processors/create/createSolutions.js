"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSolutionsProcessor = void 0;
const baseProcessor_js_1 = require("../baseProcessor.js");
const openai_1 = require("langchain/chat_models/openai");
const schema_1 = require("langchain/schema");
const constants_js_1 = require("../../../../constants.js");
const webPage_js_1 = require("../../vectorstore/webPage.js");
class CreateSolutionsProcessor extends baseProcessor_js_1.BaseProcessor {
    webPageVectorStore = new webPage_js_1.WebPageVectorStore();
    async renderRefinePrompt(results, generalTextContext, scientificTextContext, openDataTextContext, newsTextContext, subProblemIndex, alreadyCreatedSolutions = undefined) {
        const messages = [
            new schema_1.SystemChatMessage(`
        As an expert, your task is to refine the innovative solutions proposed for complex problems and associated sub-problems.

        Please follow these guidelines:
        1. Review and refine the solutions previously generated, avoiding creation of new solutions.
        2. Solutions should be feasible, considered, innovative, fair, and concise.
        3. Limit solution descriptions to a maximum of six sentences.
        4. Avoid replicating solutions listed under 'Already Created Solutions'.
        5. Refer to the relevant entities in your solutions, if mentioned.
        6. Utilize the provided contexts to inform and enhance your solutions.
        7. Avoid mentioning the contexts as it will not be visible to the user.
        8. Ensure your output is not in markdown format.
        9. For each problem and sub-problem, produce the solutions in the following JSON format: [ { title, description, howCanSolutionHelp, mainObstacleToSolutionAdoption } ].
        10. Apply a methodical, step-by-step approach to deliver optimal solutions.
        `),
            new schema_1.HumanChatMessage(`
        ${this.renderPromblemsWithIndexAndEntities(subProblemIndex)}

        ${alreadyCreatedSolutions
                ? `
          Already Created Solutions:
          ${alreadyCreatedSolutions}
        `
                : ``}

        Previous Solutions JSON Output to Review and Refine:
        ${JSON.stringify(results, null, 2)}

        Refined Solutions JSON Output:
       `),
        ];
        return messages;
    }
    renderCreateSystemMessage() {
        return new schema_1.SystemChatMessage(`
      As an expert, you are tasked with crafting innovative solutions for complex problems and associated sub-problems, considering the affected entities.

      Adhere to the following guidelines:
      1. Solutions should be practical, thoughtful, innovative, fair, and succinct.
      2. Generate seven solutions, presented in JSON format.
      3. Each solution should include a short title, description, and explanation of its benefits.
      4. Limit the description of each solution to six sentences maximum.
      5. Avoid creating solutions listed under 'Already Created Solutions'.
      6. If entities are mentioned, ensure they are relevant to the proposed solutions.
      7. The four different contexts provided should inform and inspire your solutions.
      8. Refrain from referring to the contexts, as it won't be visible to the user.
      9. Do not use markdown format in your output.
      10. For each problem and sub-problem, generate the solutions in the following JSON format: [ { title, description, howCanSolutionHelp, mainObstacleToSolutionAdoption } ].
      11. Employ a methodical, step-by-step approach to devise the best possible solutions.
      `);
    }
    renderCreateForTestTokens(subProblemIndex, alreadyCreatedSolutions = undefined) {
        const messages = [
            this.renderCreateSystemMessage(),
            new schema_1.HumanChatMessage(`
            ${this.renderPromblemsWithIndexAndEntities(subProblemIndex)}

            Possible general context for solutions:

            Possible scientific context for solutions:

            Possible open data context for solutions:

            Possible news context for solutions:

            ${alreadyCreatedSolutions
                ? `
              Already created solutions:
              ${alreadyCreatedSolutions}
            `
                : ``}

            Solutions JSON Output:
           `),
        ];
        return messages;
    }
    async renderCreatePrompt(generalTextContext, scientificTextContext, openDataTextContext, newsTextContext, subProblemIndex, alreadyCreatedSolutions = undefined) {
        const messages = [
            this.renderCreateSystemMessage(),
            new schema_1.HumanChatMessage(`
        ${this.renderPromblemsWithIndexAndEntities(subProblemIndex)}

        Contexts for potential solutions:
        General Context:
        ${generalTextContext}

        Scientific Context:
        ${scientificTextContext}

        Open Data Context:
        ${openDataTextContext}

        News Context:
        ${newsTextContext}

        ${alreadyCreatedSolutions
                ? `
          Previously Created Solutions:
          ${alreadyCreatedSolutions}
        `
                : ``}

        Output in JSON Format:
       `),
        ];
        return messages;
    }
    async createSolutions(subProblemIndex, generalTextContext, scientificTextContext, openDataTextContext, newsTextContext, alreadyCreatedSolutions = undefined) {
        let results = await this.callLLM("create-seed-solutions", constants_js_1.IEngineConstants.createSeedSolutionsModel, await this.renderCreatePrompt(generalTextContext, scientificTextContext, openDataTextContext, newsTextContext, subProblemIndex, alreadyCreatedSolutions));
        if (constants_js_1.IEngineConstants.enable.refine.createSolutions) {
            results = await this.callLLM("create-seed-solutions", constants_js_1.IEngineConstants.createSeedSolutionsModel, await this.renderRefinePrompt(results, generalTextContext, scientificTextContext, openDataTextContext, newsTextContext, subProblemIndex, alreadyCreatedSolutions));
        }
        return results;
    }
    randomSearchQueryIndex(subProblemIndex) {
        const randomIndex = Math.min(Math.floor(Math.random() *
            (constants_js_1.IEngineConstants.maxTopSearchQueriesForSolutionCreation + 1)), subProblemIndex
            ? this.memory.subProblems[subProblemIndex].searchQueries.general
                .length - 1
            : 2);
        if (Math.random() <
            constants_js_1.IEngineConstants.chances.notUsingFirstSearchQueryForNewSolutions) {
            return randomIndex;
        }
        else {
            return 0;
        }
    }
    getAllTypeQueries(searchQueries, subProblemIndex) {
        return {
            general: searchQueries.general[this.randomSearchQueryIndex(subProblemIndex)],
            scientific: searchQueries.scientific[this.randomSearchQueryIndex(subProblemIndex)],
            openData: searchQueries.openData[this.randomSearchQueryIndex(subProblemIndex)],
            news: searchQueries.news[this.randomSearchQueryIndex(subProblemIndex)],
        };
    }
    getRandomSearchQueryForType(type, problemStatementQueries, subProblemQueries, otherSubProblemQueries) {
        let random = Math.random();
        let selectedQuery;
        if (random < constants_js_1.IEngineConstants.chances.useMainProblemSearchQueriesNewSolutions) {
            selectedQuery = problemStatementQueries[type];
        }
        else if (random <
            constants_js_1.IEngineConstants.chances.useOtherSubProblemSearchQueriesNewSolutions +
                constants_js_1.IEngineConstants.chances.useMainProblemSearchQueriesNewSolutions) {
            selectedQuery = otherSubProblemQueries[type];
        }
        else {
            selectedQuery = subProblemQueries[type];
        }
        return selectedQuery;
    }
    getSearchQueries(subProblemIndex) {
        const otherSubProblemIndexes = [];
        for (let i = 0; i < this.memory.subProblems.length; i++) {
            if (i != subProblemIndex) {
                otherSubProblemIndexes.push(i);
            }
        }
        const randomSubProblemIndex = otherSubProblemIndexes[Math.floor(Math.random() * otherSubProblemIndexes.length)];
        const problemStatementQueries = this.getAllTypeQueries(this.memory.problemStatement.searchQueries, undefined);
        const subProblemQueries = this.getAllTypeQueries(this.memory.subProblems[subProblemIndex].searchQueries, subProblemIndex);
        const otherSubProblemQueries = this.getAllTypeQueries(this.memory.subProblems[randomSubProblemIndex].searchQueries, randomSubProblemIndex);
        //TODO: Refactor the types to be an array ["scientific", "general", ...]
        let scientific = this.getRandomSearchQueryForType("scientific", problemStatementQueries, subProblemQueries, otherSubProblemQueries);
        let general = this.getRandomSearchQueryForType("general", problemStatementQueries, subProblemQueries, otherSubProblemQueries);
        let openData = this.getRandomSearchQueryForType("openData", problemStatementQueries, subProblemQueries, otherSubProblemQueries);
        let news = this.getRandomSearchQueryForType("news", problemStatementQueries, subProblemQueries, otherSubProblemQueries);
        return {
            scientific,
            general,
            openData,
            news,
        };
    }
    async getTextContext(subProblemIndex, alreadyCreatedSolutions = undefined) {
        const selectedSearchQueries = this.getSearchQueries(subProblemIndex);
        return {
            general: await this.getSearchQueryTextContext(subProblemIndex, selectedSearchQueries["general"], "general", alreadyCreatedSolutions),
            scientific: await this.getSearchQueryTextContext(subProblemIndex, selectedSearchQueries["scientific"], "scientific", alreadyCreatedSolutions),
            openData: await this.getSearchQueryTextContext(subProblemIndex, selectedSearchQueries["openData"], "openData", alreadyCreatedSolutions),
            news: await this.getSearchQueryTextContext(subProblemIndex, selectedSearchQueries["news"], "news", alreadyCreatedSolutions),
        };
    }
    async countTokensForString(text) {
        const tokenCountData = await this.chat.getNumTokensFromMessages([
            new schema_1.HumanChatMessage(text),
        ]);
        return tokenCountData.totalCount;
    }
    //TODO: Figure out the closest allRelevantParagraphs from Weaviate
    renderRawSearchResults(rawSearchResults) {
        const results = rawSearchResults.data.Get.WebPage;
        let searchResults = `
      ${results.summary}

      ${results.relevanceToProblem}

      ${results.possibleSolutionsToProblem.join("\n")}

      ${results.allRelevantParagraphs.join("\n")}
    `;
        return searchResults;
    }
    async searchForType(subProblemIndex, type, searchQuery, tokensLeftForType) {
        let rawSearchResults;
        const random = Math.random();
        if (random < constants_js_1.IEngineConstants.chances.useMainProblemVectorSearchNewSolutions) {
            rawSearchResults = await this.webPageVectorStore.searchWebPages(searchQuery, this.memory.groupId, undefined, type);
        }
        else {
            rawSearchResults = await this.webPageVectorStore.searchWebPages(searchQuery, this.memory.groupId, subProblemIndex, type);
        }
        let searchResults = this.renderRawSearchResults(rawSearchResults);
        while ((await this.countTokensForString(searchResults)) > tokensLeftForType) {
            let sentences = searchResults.split(". ");
            sentences.pop();
            searchResults = sentences.join(". ");
        }
        return searchResults;
    }
    async getSearchQueryTextContext(subProblemIndex, searchQuery, type, alreadyCreatedSolutions = undefined) {
        const tokenCountData = await this.chat.getNumTokensFromMessages(this.renderCreateForTestTokens(subProblemIndex, alreadyCreatedSolutions));
        const currentTokens = tokenCountData.totalCount;
        const tokensLeft = constants_js_1.IEngineConstants.createSeedSolutionsModel.tokenLimit -
            (currentTokens +
                constants_js_1.IEngineConstants.createSeedSolutionsModel.maxOutputTokens);
        const tokensLeftForType = Math.floor(tokensLeft / constants_js_1.IEngineConstants.numberOfSearchTypes);
        this.logger.debug(`Tokens left for type: ${tokensLeftForType} for type ${type}`);
        return await this.searchForType(subProblemIndex, type, searchQuery, tokensLeftForType);
    }
    async createAllSolutions() {
        for (let subProblemIndex = 0; subProblemIndex <
            Math.min(this.memory.subProblems.length, constants_js_1.IEngineConstants.maxSubProblems); subProblemIndex++) {
            let solutions = [];
            // Create 28 solutions 7*4
            for (let i = 0; i < 4; i++) {
                let alreadyCreatedSolutions;
                if (i > 0) {
                    alreadyCreatedSolutions = solutions
                        .map((solution) => solution.title)
                        .join("\n");
                }
                const textContexts = await this.getTextContext(subProblemIndex, alreadyCreatedSolutions);
                const newSolutions = await this.createSolutions(i, textContexts.general, textContexts.scientific, textContexts.openData, textContexts.news, alreadyCreatedSolutions);
                solutions = solutions.concat(newSolutions);
            }
            this.memory.subProblems[subProblemIndex].solutions.seed = solutions;
            await this.saveMemory();
        }
    }
    async process() {
        this.logger.info("Create Seed Solutions Processor");
        super.process();
        this.chat = new openai_1.ChatOpenAI({
            temperature: constants_js_1.IEngineConstants.createSearchQueriesModel.temperature,
            maxTokens: constants_js_1.IEngineConstants.createSearchQueriesModel.maxOutputTokens,
            modelName: constants_js_1.IEngineConstants.createSearchQueriesModel.name,
            verbose: constants_js_1.IEngineConstants.createSearchQueriesModel.verbose,
        });
        await this.createAllSolutions();
    }
}
exports.CreateSolutionsProcessor = CreateSolutionsProcessor;
