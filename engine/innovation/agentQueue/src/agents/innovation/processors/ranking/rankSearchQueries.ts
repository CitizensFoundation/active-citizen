import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../../constants.js";
import { BasePairwiseRankingsProcessor } from "./basePairwiseRanking.js";

export class RankSearchQueriesProcessor extends BasePairwiseRankingsProcessor {
  subProblemIndex = 0;
  entitiesIndex = 0;
  currentEntity!: IEngineAffectedEntity;
  searchQueryType!: IEngineWebPageTypes;
  searchQueryTarget!: IEngineWebPageTargets;

  async voteOnPromptPair(
    promptPair: number[]
  ): Promise<IEnginePairWiseVoteResults> {
    const itemOneIndex = promptPair[0];
    const itemTwoIndex = promptPair[1];

    const itemOne = this.allItems![itemOneIndex] as string;
    const itemTwo = this.allItems![itemTwoIndex] as string;

    const messages = [
      new SystemChatMessage(
        `
        You are an expert trained to analyse complex problem statements and sub problems to rank search queries to search for solutions for those problems.

        Adhere to the following guidelines:
        1. You will see the problem statement or problem statement with one sub-problem possibly with entities and how the problems affect them in negative or positive ways.
        2. Then you will see two web links with a title and description. One is marked as "Search Query One" and the other as "Search Query Two".
        3. You will analyse, compare and rank those two search queries and vote on which one is more relevant as a solution to the problem statement, sub-problem and entities.
        4. You will only output the winning item as: "One" or "Two" without an explaination.
        5. Ensure a methodical, step-by-step approach.        `
      ),
      new HumanChatMessage(
        `
        ${
          this.searchQueryTarget === "subProblem"
            ? `
          ${this.renderPromblemsWithIndexAndEntities(this.subProblemIndex)}
        `
            : `
          ${this.renderProblemStatement()}

          ${this.renderSubProblem(this.currentSubProblemIndex!)}

          Entity:
          ${this.currentEntity!.name}
          ${this.renderEntityPosNegReasons(this.currentEntity!)}
        `
        }

         Search queries to vote on:

         Search Query One:
         ${itemOne}

         Search Query Two:
         ${itemTwo}

         The winning search query is:
       `
      ),
    ];

    return await this.getResultsFromLLM(
      "rank-search-pages",
      IEngineConstants.searchQueryRankingsModel,
      messages,
      itemOneIndex,
      itemTwoIndex
    );
  }

  async processSubProblems(searchQueryType: IEngineWebPageTypes) {
    for (
      let s = 0;
      s <
      Math.min(this.memory.subProblems.length, IEngineConstants.maxSubProblems);
      s++
    ) {
      let queriesToRank;
      if (searchQueryType === "general") {
        queriesToRank =
          this.memory.subProblems[s].searchQueries.generalSearchQueries;
      } else if (searchQueryType === "scientific") {
        queriesToRank =
          this.memory.subProblems[s].searchQueries.scientificSearchQueries;
      } else if (searchQueryType === "openData") {
        queriesToRank =
          this.memory.subProblems[s].searchQueries.openDataSearchQueries;
      } else if (searchQueryType === "news") {
        queriesToRank =
          this.memory.subProblems[s].searchQueries.newsSearchQueries;
      } else {
        throw new Error(`Unknown search query type: ${searchQueryType}`);
      }

      this.subProblemIndex = s;
      this.searchQueryTarget = "subProblem";
      this.setupRankingPrompts(queriesToRank);
      await this.performPairwiseRanking();

      if (searchQueryType === "general") {
        this.memory.subProblems[s].searchQueries.generalSearchQueries =
          this.getOrderedListOfItems() as string[];
      } else if (searchQueryType === "scientific") {
        this.memory.subProblems[s].searchQueries.scientificSearchQueries =
          this.getOrderedListOfItems() as string[];
      } else if (searchQueryType === "openData") {
        this.memory.subProblems[s].searchQueries.openDataSearchQueries =
          this.getOrderedListOfItems() as string[];
      } else if (searchQueryType === "news") {
        this.memory.subProblems[s].searchQueries.newsSearchQueries =
          this.getOrderedListOfItems() as string[];
      }

      this.searchQueryTarget = "entity";
      await this.processEntities(s, searchQueryType);

      await this.saveMemory();
    }
  }

  async processEntities(
    subProblemIndex: number,
    searchQueryType: IEngineWebPageTypes
  ) {
    for (
      let e = 0;
      e <
      Math.min(
        this.memory.subProblems[subProblemIndex].entities.length,
        IEngineConstants.maxTopEntitiesToSearch
      );
      e++
    ) {
      let queriesToRank;
      this.currentEntity = this.memory.subProblems[subProblemIndex].entities[e];
      if (searchQueryType === "general") {
        queriesToRank =
          this.memory.subProblems[subProblemIndex].entities[e].searchQueries!
            .generalSearchQueries;
      } else if (searchQueryType === "scientific") {
        queriesToRank =
          this.memory.subProblems[subProblemIndex].entities[e].searchQueries!
            .scientificSearchQueries;
      } else if (searchQueryType === "openData") {
        queriesToRank =
          this.memory.subProblems[subProblemIndex].entities[e].searchQueries!
            .openDataSearchQueries;
      } else if (searchQueryType === "news") {
        queriesToRank =
          this.memory.subProblems[subProblemIndex].entities[e].searchQueries!
            .newsSearchQueries;
      } else {
        throw new Error(`Unknown search query type: ${searchQueryType}`);
      }

      this.setupRankingPrompts(queriesToRank);
      await this.performPairwiseRanking();

      if (searchQueryType === "general") {
        this.memory.subProblems[subProblemIndex].entities[
          e
        ].searchQueries!.generalSearchQueries =
          this.getOrderedListOfItems() as string[];
      } else if (searchQueryType === "scientific") {
        this.memory.subProblems[subProblemIndex].entities[
          e
        ].searchQueries!.scientificSearchQueries =
          this.getOrderedListOfItems() as string[];
      } else if (searchQueryType === "openData") {
        queriesToRank = this.memory.subProblems[subProblemIndex].entities[
          e
        ].searchQueries!.openDataSearchQueries =
          this.getOrderedListOfItems() as string[];
      } else if (searchQueryType === "news") {
        queriesToRank = this.memory.subProblems[subProblemIndex].entities[
          e
        ].searchQueries!.newsSearchQueries =
          this.getOrderedListOfItems() as string[];
      }
    }
  }

  async process() {
    this.logger.info("Rank Search Queries Processor");
    super.process();

    this.chat = new ChatOpenAI({
      temperature: IEngineConstants.searchQueryRankingsModel.temperature,
      maxTokens: IEngineConstants.searchQueryRankingsModel.maxTokens,
      modelName: IEngineConstants.searchQueryRankingsModel.name,
      verbose: IEngineConstants.searchQueryRankingsModel.verbose,
    });

    for (const searchQueryType in [
      "general",
      "scientific",
      "openData",
      "news",
    ] as IEngineWebPageTypes[]) {
      this.searchQueryType = searchQueryType as IEngineWebPageTypes;
      this.processSubProblems(searchQueryType as IEngineWebPageTypes);
    }

    await this.saveMemory();
  }
}
