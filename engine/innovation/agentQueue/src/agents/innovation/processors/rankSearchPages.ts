import { BaseProcessor } from "./baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../constants.js";
import { BasePairwiseRankingsProcessor } from "./basePairwiseRanking.js";

export class RankSearchPagesProcessor extends BasePairwiseRankingsProcessor {
  problemSubProblemIndex = 0;

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
        You are an expert trained to analyse complex problem statements and sub-problems to rank web links to search to find solutions for those problems.

        Adhere to the following guidelines:
        1. You will see the problem statement or problem statement with one sub-problem possibly with entities and how the problems affect them in negative or positive ways.
        2. Then you will see two web links with a title and description. One is marked as "Item 1" and the other as "Item 2".
        3. You will analyse, compare and rank those two web link items and vote on which one is more relevant as a solution to the problem statement, sub-problem and entities.
        4. You will only output the winning item as: "Item 1" or "Item 2" without an explaination.
        5. Ensure a methodical, step-by-step approach to create the best possible search queries.        `
      ),
      new HumanChatMessage(
        `
         ${this.renderPromblemsWithIndexAndEntities(
           this.problemSubProblemIndex
         )}

         Items to vote on:

         Item 1:
         ${itemOneTitle}
         ${itemOneDescription}

         Item 2:
         ${itemTwoTitle}
         ${itemTwoDescription}

         The winning item is:
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

  getUrlsToDownload(indexesForUrls: number[]) {
    const urls = indexesForUrls.map((index) => {
      const item = this.allItems![index] as SerpOrganicResult;
      return item.link;
    });
    return urls;
  }

  async processGeneralUrls(results: SerpOrganicResult[][]) {
    const outUrlsForAll: string[][] = [];
    const outPagesForAll: SerpOrganicResult[][] = [];

    for (const result of results) {
      this.setupPrompts(result);
      await this.performPairwiseRanking();

      const pages = this.getOrderedListOfItems();
      outUrlsForAll.push(
        pages.map((item) => {
          return (item as SerpOrganicResult).link;
        })
      );
      this.problemSubProblemIndex++;
      outPagesForAll.push(pages as SerpOrganicResult[]);
    }

    return { outUrlsForAll, outPagesForAll };
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

    let { outUrlsForAll, outPagesForAll } = await this.processGeneralUrls(this.memory.searchResults.all.general);

    this.memory.searchResults.orderedURLsToGet.general = outUrlsForAll;
    this.memory.searchResults.orderedSearchPages.general = outPagesForAll;

    ({ outUrlsForAll, outPagesForAll } = await this.processGeneralUrls(this.memory.searchResults.all.scientific));

    this.memory.searchResults.orderedURLsToGet.scientific = outUrlsForAll;
    this.memory.searchResults.orderedSearchPages.scientific = outPagesForAll;

    await this.saveMemory();
  }
}
