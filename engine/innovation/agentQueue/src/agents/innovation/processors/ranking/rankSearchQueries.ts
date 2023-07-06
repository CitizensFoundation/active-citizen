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

  renderProblemDetail() {
    let detail = ``;

    if (this.searchQueryTarget === "problemStatement") {
      detail = `
        ${this.renderProblemStatement()}
      `;
    } else if (this.searchQueryTarget === "subProblem") {
      detail = `
        ${this.renderPromblemsWithIndexAndEntities(this.subProblemIndex)}
      `;
    } else if (this.searchQueryTarget === "entity") {
      detail = `
        ${this.renderProblemStatement()}

        ${this.renderSubProblem(this.currentSubProblemIndex!)}

        Entity:
        ${this.currentEntity!.name}
        ${this.renderEntityPosNegReasons(this.currentEntity!)}
      `;
    }

    return detail;
  }

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
        You are an AI expert trained to rank search queries based on their relevance to complex problem statements, sub-problems and affected entities.

        Please follow these guidelines:
        1. You will receive a problem statement or a sub-problem, possibly along with entities and their impacts (both negative and positive).
        2. You will also see two web search queries, each marked as "Search Query One" and "Search Query Two".
        3. Your task is to analyze, compare, and rank these search queries based on their relevance to the given problemm sub-problem and affected entities.
        4. Output your decision as either "One" or "Two". No explanation is required.
        5. Ensure a systematic and methodical approach to this task.`
      ),
      new HumanChatMessage(
        `
        Search query type: ${this.searchQueryType}

        ${this.renderProblemDetail()}

        Search Queries to Rank:

        Search Query One:
        ${itemOne}

        Search Query Two:
        ${itemTwo}

        The Most Relevant Search Query Is:
       `
      ),
    ];


    return await this.getResultsFromLLM(
      "rank-search-queries",
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
      let queriesToRank =
        this.memory.subProblems[s].searchQueries[searchQueryType];

      this.subProblemIndex = s;
      this.searchQueryTarget = "subProblem";

      this.setupRankingPrompts(queriesToRank);
      await this.performPairwiseRanking();

      this.memory.subProblems[s].searchQueries[searchQueryType] =
        this.getOrderedListOfItems() as string[];

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
      this.currentEntity = this.memory.subProblems[subProblemIndex].entities[e];
      let queriesToRank =
        this.memory.subProblems[subProblemIndex].entities[e].searchQueries![
          searchQueryType
        ];

      this.setupRankingPrompts(queriesToRank);
      await this.performPairwiseRanking();

      this.memory.subProblems[subProblemIndex].entities[e].searchQueries![
        searchQueryType
      ] = this.getOrderedListOfItems() as string[];
    }
  }

  async process() {
    this.logger.info("Rank Search Queries Processor");
    super.process();

    this.chat = new ChatOpenAI({
      temperature: IEngineConstants.searchQueryRankingsModel.temperature,
      maxTokens: IEngineConstants.searchQueryRankingsModel.maxOutputTokens,
      modelName: IEngineConstants.searchQueryRankingsModel.name,
      verbose: IEngineConstants.searchQueryRankingsModel.verbose,
    });

    for (const searchQueryType of [
      "general",
      "scientific",
      "openData",
      "news",
    ] as const) {
      let queriesToRank =
        this.memory.problemStatement.searchQueries![searchQueryType];

      this.searchQueryTarget = "problemStatement";

      this.setupRankingPrompts(queriesToRank);
      await this.performPairwiseRanking();

      this.memory.problemStatement.searchQueries[searchQueryType] =
        this.getOrderedListOfItems() as string[];

      this.searchQueryType = searchQueryType;
      this.processSubProblems(searchQueryType);
    }

    await this.saveMemory();
  }
}
