import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../../constants.js";
import { BasePairwiseRankingsProcessor } from "./basePairwiseRanking.js";

export class RankSolutionsProcessor extends BasePairwiseRankingsProcessor {
  subProblemIndex = 0;

  async voteOnPromptPair(
    promptPair: number[]
  ): Promise<IEnginePairWiseVoteResults> {
    const itemOneIndex = promptPair[0];
    const itemTwoIndex = promptPair[1];

    const solutionOne = this.allItems![itemOneIndex] as IEngineSolution;
    const solutionTwo = this.allItems![itemTwoIndex] as IEngineSolution;

    const messages = [
      new SystemChatMessage(
        `
        You are an expert trained to analyse solutions to complex problem statements and sub-problems.

        Adhere to the following guidelines:
        1. You will see the problem statement with two solutions to compare. One is marked as "Solution One" and the other as "Solution Two".
        2. You will analyse, compare and rank those two solutions and vote on which one is more relevant and important as sub problem of the main problem statement.
        3. You will only output the winning item as: "One" or "Two" without an explanation.
        4. Ensure a methodical, step-by-step approach.
        `
      ),
      new HumanChatMessage(
        `
         ${this.renderProblemStatement()}

         Solutions to vote on:

         Solution One:
         ----------------------------------------
         ${solutionOne.title}
         ${solutionOne.description}

         How can Solution One help:
         ${solutionOne.howCanSolutionHelp}

         Main obstacle to Solution One adoption:
         ${solutionOne.mainObstacleToSolutionAdoption}

         Here are the main pros for Solution One:
         ${this.getTopPros(solutionOne.pros!.slice(0, IEngineConstants.maxProsConsUsed))}

         Here are the main cons for Solution One:
         ${this.getTopCons(solutionOne)}

         Solution Two:
         ----------------------------------------
         ${solutionTwo.title}
         ${solutionTwo.description}

         How can Solution Two help:
         ${solutionTwo.howCanSolutionHelp}

         Main obstacle to Solution Two adoption:
         ${solutionTwo.mainObstacleToSolutionAdoption}

         Here are the main pros for Solution Two:
         ${this.getTopPros(solutionTwo)}

         Here are the main cons for Solution Two:
         ${this.getTopCons(solutionTwo)}

         The winning solution is:
       `
      ),
    ];

    return await this.getResultsFromLLM(
      "rank-solutions",
      IEngineConstants.solutionsRankingsModel,
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
