import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../constants.js";
import { BasePairwiseRankingsProcessor } from "./basePairwiseRanking.js";

export class RankSearchResultsProcessor extends BasePairwiseRankingsProcessor {
  subProblemIndex = 0;
  entitiesIndex = 0;
  currentEntity!: IEngineAffectedEntity;
  searchResultType!: IEngineWebPageTypes;
  searchResultTarget!: IEngineWebPageTargets;

  renderProblemDetail() {
    let detail = ``;
    if ( this.searchResultTarget === "problemStatement") {
      detail = `
        ${this.renderProblemStatement()}
      `
    } else if ( this.searchResultTarget === "subProblem") {
      detail = `
        ${this.renderSubProblem(this.subProblemIndex!)}
      `
    } else if (this.searchResultTarget === "entity") {
      detail = `
        ${this.renderSubProblem(this.subProblemIndex!)}

        Entity:
        ${this.currentEntity!.name}
        ${this.renderEntityPosNegReasons(this.currentEntity!)}
      `
    }

    return detail;
  }

  async voteOnPromptPair(
    promptPair: number[]
  ): Promise<IEnginePairWiseVoteResults> {
    const itemOneIndex = promptPair[0];
    const itemTwoIndex = promptPair[1];

    const itemOne = this.allItems![itemOneIndex] as SerpOrganicResult;
    const itemTwo = this.allItems![itemTwoIndex] as SerpOrganicResult;

    let itemOneTitle = itemOne.title;
    let itemOneDescription = itemOne.snippet;

    let itemTwoTitle = itemTwo.title;
    let itemTwoDescription = itemTwo.snippet;

    const messages = [
      new SystemChatMessage(
        `
        You are an AI expert, trained to rank search results pertaining to complex problem statements and sub-problems.

        Please adhere to these guidelines:
        1. You will be presented with a problem statement or sub-problem, possibly including entities affected by the problem in either positive or negative ways.
        2. You will also receive two web links, each accompanied by a title and description, marked as "Search Result One" and "Search Result Two".
        3. Your task is to analyze, compare, and rank these search results based on their relevance to the provided problem statement or sub-problem.
        4. Output your decision as either "One" or "Two". No explanation is required.
        5. Ensure your approach is methodical and systematic. Think step by step.`
      ),
      new HumanChatMessage(
        `
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
       `
      ),
    ];

    return await this.getResultsFromLLM(
      "rank-search-results",
      IEngineConstants.searchResultsRankingsModel,
      messages,
      itemOneIndex,
      itemTwoIndex
    );
  }

  async processSubProblems(searchResultType: IEngineWebPageTypes) {
    for (
      let s = 0;
      s <
      Math.min(this.memory.subProblems.length, IEngineConstants.maxSubProblems);
      s++
    ) {
      this.logger.info(`Ranking Sub Problem ${s} for ${searchResultType} search results`)
      let resultsToRank = this.memory.subProblems[s].searchResults.pages[searchResultType];

      this.subProblemIndex = s;
      this.searchResultTarget = "subProblem";
      this.setupRankingPrompts(resultsToRank);
      await this.performPairwiseRanking();

      this.memory.subProblems[s].searchResults.pages[searchResultType] =
          this.getOrderedListOfItems(true) as SerpOrganicResult[]

      await this.saveMemory();

      this.searchResultTarget = "entity";
      await this.processEntities(s, searchResultType);
    }
  }

  async processEntities(
    subProblemIndex: number,
    searchResultType: IEngineWebPageTypes
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
      this.logger.info(`Ranking Entity ${subProblemIndex}-${e} for ${searchResultType} search results`)
      this.currentEntity = this.memory.subProblems[subProblemIndex].entities[e];
      let resultsToRank = this.memory.subProblems[subProblemIndex].entities[e].searchResults!.pages[searchResultType];

      this.setupRankingPrompts(resultsToRank);
      await this.performPairwiseRanking();

      this.memory.subProblems[subProblemIndex].entities[
        e
      ].searchResults!.pages[searchResultType] =
        this.getOrderedListOfItems(true) as SerpOrganicResult[];
    }
  }

  async process() {
    this.logger.info("Rank Search Results Processor");
    super.process();

    this.chat = new ChatOpenAI({
      temperature: IEngineConstants.searchResultsRankingsModel.temperature,
      maxTokens: IEngineConstants.searchResultsRankingsModel.maxOutputTokens,
      modelName: IEngineConstants.searchResultsRankingsModel.name,
      verbose: IEngineConstants.searchResultsRankingsModel.verbose,
    });

    for (const searchResultType of [
      "general",
      "scientific",
      "openData",
      "news",
    ] as const) {
      this.searchResultType = searchResultType;

      let resultsToRank = this.memory.problemStatement.searchResults!.pages[searchResultType];

      this.searchResultTarget = "problemStatement";

      this.logger.info(`Ranking Main Problem statement for ${searchResultType} search results`)
      this.setupRankingPrompts(resultsToRank);
      await this.performPairwiseRanking();

      this.memory.problemStatement.searchResults.pages[searchResultType] = this.getOrderedListOfItems(true) as SerpOrganicResult[];

      await this.processSubProblems(searchResultType);
    }

    await this.saveMemory();
  }
}
