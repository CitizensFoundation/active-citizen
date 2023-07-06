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
         ${this.renderPromblemsWithIndexAndEntities(this.subProblemIndex)}

         Solutions to vote on

         Solution One:
         ----------------------------------------
         ${solutionOne.title}
         ${solutionOne.description}

         How can Solution One help:
         ${solutionOne.howCanSolutionHelp}

         Main obstacle to Solution One adoption:
         ${solutionOne.mainObstacleToSolutionAdoption}

         Here are the main pros for Solution One:
         ${solutionOne.pros!.slice(
           0,
           IEngineConstants.maxProsConsUsedForRanking
         )}

         Here are the main cons for Solution One:
         ${solutionOne.cons!.slice(
           0,
           IEngineConstants.maxProsConsUsedForRanking
         )}

         Solution Two:
         ----------------------------------------
         ${solutionTwo.title}
         ${solutionTwo.description}

         How can Solution Two help:
         ${solutionTwo.howCanSolutionHelp}

         Main obstacle to Solution Two adoption:
         ${solutionTwo.mainObstacleToSolutionAdoption}

         Here are the main pros for Solution Two:
         ${solutionTwo.pros!.slice(
           0,
           IEngineConstants.maxProsConsUsedForRanking
         )}

         Here are the main cons for Solution Two:
         ${solutionTwo.cons!.slice(
           0,
           IEngineConstants.maxProsConsUsedForRanking
         )}

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
    this.logger.info("Rank Solutions Processor");
    super.process();

    this.chat = new ChatOpenAI({
      temperature: IEngineConstants.subProblemsRankingsModel.temperature,
      maxTokens: IEngineConstants.subProblemsRankingsModel.maxOutputTokens,
      modelName: IEngineConstants.subProblemsRankingsModel.name,
      verbose: IEngineConstants.subProblemsRankingsModel.verbose,
    });

    for (
      let s = 0;
      s <
      Math.min(this.memory.subProblems.length, IEngineConstants.maxSubProblems);
      s++
    ) {

      this.subProblemIndex = s;

      this.setupRankingPrompts(this.memory.subProblems[s].solutions!.seed);
      await this.performPairwiseRanking();

      this.logger.debug(
        `Solutions before ranking: ${JSON.stringify(this.memory.subProblems[s].solutions!.seed)}`
      );
      this.memory.subProblems[s].solutions!.seed =
        this.getOrderedListOfItems() as IEngineSolution[];
      this.logger.debug(
        `Solutions after ranking: ${JSON.stringify(this.memory.subProblems[s].solutions!.seed)}`
      );

      await this.saveMemory();

    }
  }
}
