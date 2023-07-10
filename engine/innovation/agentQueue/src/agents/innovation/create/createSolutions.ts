import { BaseProcessor } from "../baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../constants.js";
import { WebPageVectorStore } from "../vectorstore/webPage.js";

export class CreateSolutionsProcessor extends BaseProcessor {
  webPageVectorStore = new WebPageVectorStore();

  async renderRefinePrompt(
    results: IEngineSolution[],
    generalTextContext: string,
    scientificTextContext: string,
    openDataTextContext: string,
    newsTextContext: string,
    subProblemIndex: number,
    alreadyCreatedSolutions: string | undefined = undefined
  ) {
    const messages = [
      new SystemChatMessage(
        `
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
        `
      ),
      new HumanChatMessage(
        `
        ${this.renderPromblemsWithIndexAndEntities(subProblemIndex)}

        ${
          alreadyCreatedSolutions
            ? `
          Already Created Solutions:
          ${alreadyCreatedSolutions}
        `
            : ``
        }

        Previous Solutions JSON Output to Review and Refine:
        ${JSON.stringify(results, null, 2)}

        Refined Solutions JSON Output:
       `
      ),
    ];

    return messages;
  }

  renderCreateSystemMessage() {
    return new SystemChatMessage(
      `
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
      `
    );
  }

  renderCreateForTestTokens(
    subProblemIndex: number,
    alreadyCreatedSolutions: string | undefined = undefined
  ) {
    const messages = [
      this.renderCreateSystemMessage(),
      new HumanChatMessage(
        `
            ${this.renderPromblemsWithIndexAndEntities(subProblemIndex)}

            Possible general context for solutions:

            Possible scientific context for solutions:

            Possible open data context for solutions:

            Possible news context for solutions:

            ${
              alreadyCreatedSolutions
                ? `
              Already created solutions:
              ${alreadyCreatedSolutions}
            `
                : ``
            }

            Solutions JSON Output:
           `
      ),
    ];

    return messages;
  }

  async renderCreatePrompt(
    generalTextContext: string,
    scientificTextContext: string,
    openDataTextContext: string,
    newsTextContext: string,
    subProblemIndex: number,
    alreadyCreatedSolutions: string | undefined = undefined
  ) {
    const messages = [
      this.renderCreateSystemMessage(),
      new HumanChatMessage(
        `
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

        ${
          alreadyCreatedSolutions
            ? `
          Previously Created Solutions:
          ${alreadyCreatedSolutions}
        `
            : ``
        }

        Output in JSON Format:
       `
      ),
    ];

    return messages;
  }

  async createSolutions(
    subProblemIndex: number,
    generalTextContext: string,
    scientificTextContext: string,
    openDataTextContext: string,
    newsTextContext: string,
    alreadyCreatedSolutions: string | undefined = undefined
  ): Promise<IEngineSolution[]> {
    let results = await this.callLLM(
      "create-seed-solutions",
      IEngineConstants.createSeedSolutionsModel,
      await this.renderCreatePrompt(
        generalTextContext,
        scientificTextContext,
        openDataTextContext,
        newsTextContext,
        subProblemIndex,
        alreadyCreatedSolutions
      )
    );

    if (IEngineConstants.enable.refine.createSolutions) {
      results = await this.callLLM(
        "create-seed-solutions",
        IEngineConstants.createSeedSolutionsModel,
        await this.renderRefinePrompt(
          results,
          generalTextContext,
          scientificTextContext,
          openDataTextContext,
          newsTextContext,
          subProblemIndex,
          alreadyCreatedSolutions
        )
      );
    }

    return results;
  }

  randomSearchQueryIndex(subProblemIndex: number | undefined) {
    const randomIndex = Math.min(
      Math.floor(
        Math.random() *
          (IEngineConstants.maxTopSearchQueriesForSolutionCreation + 1)
      ),
      subProblemIndex
        ? this.memory.subProblems[subProblemIndex].searchQueries.general
            .length - 1
        : 2
    );
    if (
      Math.random() <
      IEngineConstants.chances.notUsingFirstSearchQueryForNewSolutions
    ) {
      return randomIndex;
    } else {
      return 0;
    }
  }

  getAllTypeQueries(
    searchQueries: IEngineSearchQueries,
    subProblemIndex: number | undefined
  ) {
    return {
      general:
        searchQueries.general[this.randomSearchQueryIndex(subProblemIndex)],
      scientific:
        searchQueries.scientific[this.randomSearchQueryIndex(subProblemIndex)],
      openData:
        searchQueries.openData[this.randomSearchQueryIndex(subProblemIndex)],
      news: searchQueries.news[this.randomSearchQueryIndex(subProblemIndex)],
    };
  }

  getRandomSearchQueryForType(
    type: IEngineWebPageTypes,
    problemStatementQueries: IEngineSearchQuery,
    subProblemQueries: IEngineSearchQuery,
    otherSubProblemQueries: IEngineSearchQuery
  ) {
    let random = Math.random();

    let selectedQuery: string;

    if (
      random < IEngineConstants.chances.useMainProblemSearchQueriesNewSolutions
    ) {
      selectedQuery = problemStatementQueries[type];
    } else if (
      random <
      IEngineConstants.chances.useOtherSubProblemSearchQueriesNewSolutions +
        IEngineConstants.chances.useMainProblemSearchQueriesNewSolutions
    ) {
      selectedQuery = otherSubProblemQueries[type];
    } else {
      selectedQuery = subProblemQueries[type];
    }

    return selectedQuery;
  }

  getSearchQueries(subProblemIndex: number) {
    const otherSubProblemIndexes = [];

    for (let i = 0; i < this.memory.subProblems.length; i++) {
      if (i != subProblemIndex) {
        otherSubProblemIndexes.push(i);
      }
    }

    const randomSubProblemIndex =
      otherSubProblemIndexes[
        Math.floor(Math.random() * otherSubProblemIndexes.length)
      ];

    const problemStatementQueries = this.getAllTypeQueries(
      this.memory.problemStatement.searchQueries,
      undefined
    );

    const subProblemQueries = this.getAllTypeQueries(
      this.memory.subProblems[subProblemIndex].searchQueries,
      subProblemIndex
    );

    const otherSubProblemQueries = this.getAllTypeQueries(
      this.memory.subProblems[randomSubProblemIndex].searchQueries,
      randomSubProblemIndex
    );

    //TODO: Refactor the types to be an array ["scientific", "general", ...]
    let scientific = this.getRandomSearchQueryForType(
      "scientific",
      problemStatementQueries,
      subProblemQueries,
      otherSubProblemQueries
    );

    let general = this.getRandomSearchQueryForType(
      "general",
      problemStatementQueries,
      subProblemQueries,
      otherSubProblemQueries
    );

    let openData = this.getRandomSearchQueryForType(
      "openData",
      problemStatementQueries,
      subProblemQueries,
      otherSubProblemQueries
    );

    let news = this.getRandomSearchQueryForType(
      "news",
      problemStatementQueries,
      subProblemQueries,
      otherSubProblemQueries
    );

    return {
      scientific,
      general,
      openData,
      news,
    };
  }

  async getTextContext(
    subProblemIndex: number,
    alreadyCreatedSolutions: string | undefined = undefined
  ) {
    const selectedSearchQueries = this.getSearchQueries(subProblemIndex);

    return {
      general: await this.getSearchQueryTextContext(
        subProblemIndex,
        selectedSearchQueries["general"],
        "general",
        alreadyCreatedSolutions
      ),
      scientific: await this.getSearchQueryTextContext(
        subProblemIndex,
        selectedSearchQueries["scientific"],
        "scientific",
        alreadyCreatedSolutions
      ),
      openData: await this.getSearchQueryTextContext(
        subProblemIndex,
        selectedSearchQueries["openData"],
        "openData",
        alreadyCreatedSolutions
      ),
      news: await this.getSearchQueryTextContext(
        subProblemIndex,
        selectedSearchQueries["news"],
        "news",
        alreadyCreatedSolutions
      ),
    };
  }

  async countTokensForString(text: string) {
    const tokenCountData = await this.chat!.getNumTokensFromMessages([
      new HumanChatMessage(text),
    ]);
    return tokenCountData.totalCount;
  }

  //TODO: Figure out the closest mostRelevantParagraphs from Weaviate
  renderRawSearchResults(rawSearchResults: IEngineWebPageGraphQlResults) {
    const results = rawSearchResults.data.Get.WebPage;
    let searchResults = `
      ${results.summary}

      ${results.relevanceToProblem}

      ${results.solutionsToProblemIdentifiedInText.join("\n")}

      ${results.mostRelevantParagraphs.join("\n")}
    `;

    return searchResults;
  }

  async searchForType(
    subProblemIndex: number,
    type: IEngineWebPageTypes,
    searchQuery: string,
    tokensLeftForType: number
  ) {
    let rawSearchResults: IEngineWebPageGraphQlResults;

    const random = Math.random();

    if (
      random < IEngineConstants.chances.useMainProblemVectorSearchNewSolutions
    ) {
      rawSearchResults = await this.webPageVectorStore.searchWebPages(
        searchQuery,
        this.memory.groupId,
        undefined,
        type
      );
    } else {
      rawSearchResults = await this.webPageVectorStore.searchWebPages(
        searchQuery,
        this.memory.groupId,
        subProblemIndex,
        type
      );
    }

    let searchResults = this.renderRawSearchResults(rawSearchResults);

    while (
      (await this.countTokensForString(searchResults)) > tokensLeftForType
    ) {
      let sentences = searchResults.split(". ");
      sentences.pop();
      searchResults = sentences.join(". ");
    }

    return searchResults;
  }

  async getSearchQueryTextContext(
    subProblemIndex: number,
    searchQuery: string,
    type: IEngineWebPageTypes,
    alreadyCreatedSolutions: string | undefined = undefined
  ) {
    const tokenCountData = await this.chat!.getNumTokensFromMessages(
      this.renderCreateForTestTokens(subProblemIndex, alreadyCreatedSolutions)
    );
    const currentTokens = tokenCountData.totalCount;
    const tokensLeft =
      IEngineConstants.createSeedSolutionsModel.tokenLimit -
      (currentTokens +
        IEngineConstants.createSeedSolutionsModel.maxOutputTokens);
    const tokensLeftForType = Math.floor(
      tokensLeft / IEngineConstants.numberOfSearchTypes
    );
    this.logger.debug(
      `Tokens left for type: ${tokensLeftForType} for type ${type}`
    );

    return await this.searchForType(
      subProblemIndex,
      type,
      searchQuery,
      tokensLeftForType
    );
  }

  async createAllSolutions() {
    for (
      let subProblemIndex = 0;
      subProblemIndex <
      Math.min(this.memory.subProblems.length, IEngineConstants.maxSubProblems);
      subProblemIndex++
    ) {
      let solutions: IEngineSolution[] = [];

      // Create 28 solutions 7*4
      for (let i = 0; i < 4; i++) {
        let alreadyCreatedSolutions;

        if (i > 0) {
          alreadyCreatedSolutions = solutions
            .map((solution) => solution.title)
            .join("\n");
        }

        const textContexts = await this.getTextContext(
          subProblemIndex,
          alreadyCreatedSolutions
        );

        const newSolutions = await this.createSolutions(
          i,
          textContexts.general,
          textContexts.scientific,
          textContexts.openData,
          textContexts.news,
          alreadyCreatedSolutions
        );
        solutions = solutions.concat(newSolutions);
      }

      this.memory.subProblems[subProblemIndex].solutions.seed = solutions;

      await this.saveMemory();
    }
  }

  async process() {
    this.logger.info("Create Seed Solutions Processor");
    super.process();

    this.chat = new ChatOpenAI({
      temperature: IEngineConstants.createSearchQueriesModel.temperature,
      maxTokens: IEngineConstants.createSearchQueriesModel.maxOutputTokens,
      modelName: IEngineConstants.createSearchQueriesModel.name,
      verbose: IEngineConstants.createSearchQueriesModel.verbose,
    });

    await this.createAllSolutions();
  }
}
