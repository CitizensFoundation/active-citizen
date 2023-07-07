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
        As an AI expert, your role involves analyzing solutions to complex problem statements and sub-problems.

        Please adhere to the following guidelines:
        1. You will be presented with a problem statement and two corresponding solutions. These will be labelled "Solution One" and "Solution Two".
        2. Analyze, compare, and rank these solutions based on their relevance and importance to the problem statement.
        3. Consider the pros and cons of each solution while ranking.
        4. Consider the entities affected by the problem statement and sub-problem, if available, while ranking.
        5. Output your decision as either "One" or "Two". No explanation is necessary.
        6. Ensure your approach is methodical and systematic. Think step by step.
        `
      ),
      new HumanChatMessage(
        `
        ${this.renderPromblemsWithIndexAndEntities(this.subProblemIndex)}

        Solutions for Consideration:

        Solution One:
        ----------------------------------------
        Title: ${solutionOne.title}
        Description: ${solutionOne.description}

        How Solution One Can Help: ${solutionOne.howCanSolutionHelp}
        Main Obstacles to Solution One Adoption: ${solutionOne.mainObstacleToSolutionAdoption}

        Pros of Solution One:
        ${solutionOne.pros!.slice(0, IEngineConstants.maxProsConsUsedForRanking)}

        Cons of Solution One:
        ${solutionOne.cons!.slice(0, IEngineConstants.maxProsConsUsedForRanking)}

        Solution Two:
        ----------------------------------------
        Title: ${solutionTwo.title}
        Description: ${solutionTwo.description}

        How Solution Two Can Help: ${solutionTwo.howCanSolutionHelp}
        Main Obstacles to Solution Two Adoption: ${solutionTwo.mainObstacleToSolutionAdoption}

        Pros of Solution Two:
        ${solutionTwo.pros!.slice(0, IEngineConstants.maxProsConsUsedForRanking)}

        Cons of Solution Two:
        ${solutionTwo.cons!.slice(0, IEngineConstants.maxProsConsUsedForRanking)}

        The Most Effective Solution Is:
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
      temperature: IEngineConstants.solutionsRankingsModel.temperature,
      maxTokens: IEngineConstants.solutionsRankingsModel.maxOutputTokens,
      modelName: IEngineConstants.solutionsRankingsModel.name,
      verbose: IEngineConstants.solutionsRankingsModel.verbose,
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