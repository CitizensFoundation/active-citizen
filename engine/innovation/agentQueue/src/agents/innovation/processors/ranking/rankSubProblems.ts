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
        You are an expert trained to analyse complex problem statements and sub-problems to rank the sub problems.

        Adhere to the following guidelines:
        1. You will see the problem statement with two sub problems to compare. One is marked as "Sub Problem One" and the other as "Sub Problem Two".
        2. You will analyse, compare and rank those two sub problems and vote on which one is more relevant and important as sub problem of the main problem statement.
        3. You will only output the winning item as: "One" or "Two" without an explanation.
        4. Ensure a methodical, step-by-step approach.
        `
      ),
      new HumanChatMessage(
        `
         ${this.renderProblemStatement()}

         Sub Problems to vote on:

         Sub Problem One:
         ${itemOneTitle}
         ${itemOneDescription}

         Sub Problem Two:
         ${itemTwoTitle}
         ${itemTwoDescription}

         The winning sub problem is:
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
      maxTokens: IEngineConstants.subProblemsRankingsModel.maxTokens,
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