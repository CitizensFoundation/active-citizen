import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../../constants.js";
import { BasePairwiseRankingsProcessor } from "./basePairwiseRanking.js";

export class RankSubProblemsProcessor extends BasePairwiseRankingsProcessor {
  subProblemIndex = 0;

  async voteOnPromptPair(
    promptPair: number[]
  ): Promise<IEnginePairWiseVoteResults> {
    const itemOneIndex = promptPair[0];
    const itemTwoIndex = promptPair[1];

    const itemOne = this.allItems![itemOneIndex] as IEngineSubProblem;
    const itemTwo = this.allItems![itemTwoIndex] as IEngineSubProblem;

    let itemOneTitle = itemOne.title;
    let itemOneDescription = itemOne.description;

    let itemTwoTitle = itemTwo.title;
    let itemTwoDescription = itemTwo.description;

    const messages = [
      new SystemChatMessage(
        `
        You are an AI expert trained to analyse complex problem statements and associated sub-problems to determine their relevance.

        Please follow these guidelines:
        1. You will be presented with a problem statement and two associated sub-problems. These will be marked as "Sub Problem One" and "Sub Problem Two".
        2. Analyse, compare, and rank these two sub-problems in relation to the main problem statement to determine which is more relevant and important.
        3. Output your decision as either "One" or "Two". An explanation is not required.
        4. Ensure you take a methodical and step-by-step approach.
        `
      ),
      new HumanChatMessage(
        `
        Problem Statement:
        ${this.renderProblemStatement()}

        Sub-Problems for Consideration:

        Sub Problem One:
        Title: ${itemOneTitle}
        Description: ${itemOneDescription}

        Sub Problem Two:
        Title: ${itemTwoTitle}
        Description: ${itemTwoDescription}

        The Most Relevant Sub-Problem Is:
        `
      ),
    ];

    return await this.getResultsFromLLM(
      "rank-sub-problems",
      IEngineConstants.subProblemsRankingsModel,
      messages,
      itemOneIndex,
      itemTwoIndex
    );
  }


 async process() {
    this.logger.info("Rank Sub Problems Processor");
    super.process();

    this.chat = new ChatOpenAI({
      temperature: IEngineConstants.subProblemsRankingsModel.temperature,
      maxTokens: IEngineConstants.subProblemsRankingsModel.maxOutputTokens,
      modelName: IEngineConstants.subProblemsRankingsModel.name,
      verbose: IEngineConstants.subProblemsRankingsModel.verbose,
    });

    this.setupRankingPrompts(this.memory.subProblems);
    await this.performPairwiseRanking();

    this.logger.debug(`Sub problems before ranking: ${JSON.stringify(this.memory.subProblems)}`);
    this.memory.subProblems = this.getOrderedListOfItems() as IEngineSubProblem[];
    this.logger.debug(`Sub problems after ranking: ${JSON.stringify(this.memory.subProblems)}`);

    await this.saveMemory();
  }
}
