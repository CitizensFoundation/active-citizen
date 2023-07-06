import { BaseProcessor } from "../baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../../constants.js";

export class CreateIdeasProcessor extends BaseProcessor {
  //TODO: Add a review and refine stage here as well

  async createIdeas(
    subProblemIndex: number,
    generalTextContext: string,
    scientificTextContext: string,
    openDataTextContext: string,
    newsTextContext: string,
    alreadyCreatedSolutions: string | undefined = undefined
  ) {
    this.chat = new ChatOpenAI({
      temperature: IEngineConstants.createSearchQueriesModel.temperature,
      maxTokens: IEngineConstants.createSearchQueriesModel.maxTokens,
      modelName: IEngineConstants.createSearchQueriesModel.name,
      verbose: IEngineConstants.createSearchQueriesModel.verbose,
    });

    //TODO: Human review and improvements of this partly GPT-4 generated prompt
    const messages = [
      new SystemChatMessage(
        `
        You are an expert trained to analyse complex problem statements and sub-problems to create new innovative ideas for solutions to those problems.

        Adhere to the following guidelines:
        1. Solutions should be practical, thoughtful, innovative, equitable and succinct.
        2. Output seven ideas in JSON format
        3. You should write out a short title, description, and how it can help.
        4. Solution descriptions should be at most five sentences long.
        5. Do not created the same solutions if listed under Already created solutions
        6. If entities are mentioned, they should be the ones affected by the solutions.
        7. Use context given to inform and inspire your ideas for solutions.
        8. Never refer to the context given as the user won't see it.
        9. Never output in markdown format.
        10. For the main problem and all sub-problems, generate the search queries, provide an output in the following JSON format:
          [ { solutionTitle, solutionDescription, howCanItHelp } ].
        11. Ensure a methodical, step-by-step approach to create the best possible ideas.
        `
      ),
      new HumanChatMessage(
        `
        ${this.renderPromblemsWithIndexAndEntities(subProblemIndex)}

        Possible general context for ideas:
        ${generalTextContext}

        Possible scientific context for ideas:
        ${scientificTextContext}

        Possible open data context for ideas:
        ${openDataTextContext}

        Possible news context for ideas:
        ${newsTextContext}

        ${
          alreadyCreatedSolutions
            ? `
          Already created solutions:
          ${alreadyCreatedSolutions}
        `
            : ``
        }

        JSON Output:
       `
      ),
    ];

    const ideas = await this.callLLM(
      "create-seed-ideas",
      IEngineConstants.createSeedIdeasModel,
      messages
    );

    return ideas;
  }

  randomSearchQueryIndex(subProblemIndex: number | undefined) {
    const randomIndex = Math.min(
      Math.floor(
        Math.random() *
          (IEngineConstants.maxTopSearchQueriesForIdeaCreation + 1)
      ),
      subProblemIndex
        ? this.memory.subProblems[subProblemIndex].searchQueries.general
            .length - 1
        : 2
    );

    // 50% chance of not using the first search query
    if (
      Math.random() <
      IEngineConstants.chances.notUsingFirstSearchQueryForNewIdeas
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

    if (random < IEngineConstants.chances.useMainProblemSearchQueriesNewIdeas) {
      selectedQuery = problemStatementQueries[type];
    } else if (
      random <
      IEngineConstants.chances.useOtherSubProblemSearchQueriesNewIdeas +
        IEngineConstants.chances.useMainProblemSearchQueriesNewIdeas
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

  async getTextContext(subProblemIndex: number) {
    const selectedSearchQueries = this.getSearchQueries(subProblemIndex);

    return {
      general: await this.getSearchQueryTextContext(
        selectedSearchQueries["general"],
        "general"
      ),
      scientific: await this.getSearchQueryTextContext(
        selectedSearchQueries["scientific"],
        "scientific"
      ),
      openData: await this.getSearchQueryTextContext(
        selectedSearchQueries["openData"],
        "openData"
      ),
      news: await this.getSearchQueryTextContext(
        selectedSearchQueries["news"],
        "news"
      ),
    };
  }

  async getSearchQueryTextContext(
    searchQuery: string,
    type: IEngineWebPageTypes
  ) {


    const searchResults = await this.webSearch(searchQuery, type);
    return searchResults.pages.map((page) => page.description).join("\n");


  }

  async createAllIdeas() {
    for (
      let subProblemIndex = 0;
      subProblemIndex <
      Math.min(this.memory.subProblems.length, IEngineConstants.maxSubProblems);
      subProblemIndex++
    ) {
      let ideas: IEngineSolutionIdea[] = [];

      // Create 28 ideas 7*4
      for (let i = 0; i < 4; i++) {
        let alreadyCreatedSolutions;

        if (i > 0) {
          alreadyCreatedSolutions = ideas
            .map((idea) => idea.solutionTitle)
            .join("\n");
        }

        const textContexts = await this.getTextContext(subProblemIndex);

        const newIdeas = await this.createIdeas(
          i,
          textContexts.general,
          textContexts.scientific,
          textContexts.openData,
          textContexts.news,
          alreadyCreatedSolutions
        );
        ideas = ideas.concat(newIdeas);
      }

      await this.saveMemory();
    }
  }

  async process() {
    this.logger.info("Create Seed Ideas Processor");
    super.process();
    await this.createAllIdeas();
  }
}
