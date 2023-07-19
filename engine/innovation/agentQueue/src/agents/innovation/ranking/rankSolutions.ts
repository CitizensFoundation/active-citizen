import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../constants.js";
import { BasePairwiseRankingsProcessor } from "./basePairwiseRanking.js";

export class RankSolutionsProcessor extends BasePairwiseRankingsProcessor {
  subProblemIndex = 0;

  getProCons(prosCons: IEngineProCon[] | undefined) {
    if (prosCons && prosCons.length > 0) {
      return prosCons.map((proCon) => proCon.description);
    } else {
      return [];
    }
  }

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
        You are an expert in comparing and assessing solutions to problems.

        Guidelines:
        1. You will be presented with a problem and two corresponding solutions. These will be labelled "Solution One" and "Solution Two".
        2. Assess which of the two solutions is more important in relation to the problem.
        3. Consider the pros and cons of each solution while assessing.
        4. Output your decision as either "One" or "Two". No explanation is necessary.
        5. Think step by step.
        `
      ),
      new HumanChatMessage(
        `
        ${this.renderProblemStatementSubProblemsAndEntities(
          this.subProblemIndex
        )}

        Solutions to assess:

        Solution One:
        ----------------------------------------
        ${solutionOne.title}
        ${solutionOne.description}

        Pros of Solution One:
        ${this.getProCons(solutionOne.pros as IEngineProCon[]).slice(
          0,
          IEngineConstants.maxTopProsConsUsedForRanking
        )}

        Cons of Solution One:
        ${this.getProCons(solutionOne.cons as IEngineProCon[]).slice(
          0,
          IEngineConstants.maxTopProsConsUsedForRanking
        )}

        Solution Two:
        ----------------------------------------
        ${solutionTwo.title}
        ${solutionTwo.description}

        Pros of Solution Two:
        ${this.getProCons(solutionTwo.pros as IEngineProCon[]).slice(
          0,
          IEngineConstants.maxTopProsConsUsedForRanking
        )}

        Cons of Solution Two:
        ${this.getProCons(solutionTwo.cons as IEngineProCon[]).slice(
          0,
          IEngineConstants.maxTopProsConsUsedForRanking
        )}

        The more important solution is:
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

    try {
      this.chat = new ChatOpenAI({
        temperature: IEngineConstants.solutionsRankingsModel.temperature,
        maxTokens: IEngineConstants.solutionsRankingsModel.maxOutputTokens,
        modelName: IEngineConstants.solutionsRankingsModel.name,
        verbose: IEngineConstants.solutionsRankingsModel.verbose,
      });

      for (
        let s = 0;
        s <
        Math.min(
          this.memory.subProblems.length,
          IEngineConstants.maxSubProblems
        );
        s++
      ) {
        this.subProblemIndex = s;

        if (
          this.memory.subProblems[s].solutions!.seed &&
          this.memory.subProblems[s].solutions!.seed.length > 0 &&
          !(
            this.memory.subProblems[s].solutions.populations &&
            this.memory.subProblems[s].solutions.populations.length > 0 &&
            this.memory.subProblems[s].solutions.populations[0].length > 0
          )
        ) {
          this.logger.info("Converting seed solutions to first population");
          this.memory.subProblems[s].solutions.populations = [
            this.memory.subProblems[s].solutions!.seed,
          ];
          this.memory.subProblems[s].solutions!.seed = [];
        }

        const currentPopulationIndex =
          this.memory.subProblems[s].solutions.populations.length - 1;

        this.setupRankingPrompts(
          this.memory.subProblems[s].solutions.populations[
            currentPopulationIndex
          ]
        );

        await this.performPairwiseRanking();

        this.logger.debug(
          `Population Solutions before ranking: ${JSON.stringify(
            this.memory.subProblems[s].solutions.populations[
              currentPopulationIndex
            ]
          )}`
        );

        this.memory.subProblems[s].solutions.populations[
          currentPopulationIndex
        ] = this.getOrderedListOfItems(true) as IEngineSolution[];

        this.logger.debug(
          `Popuplation Solutions after ranking: ${JSON.stringify(
            this.memory.subProblems[s].solutions.populations[
              currentPopulationIndex
            ]
          )}`
        );

        await this.saveMemory();
      }
    } catch (error) {
      this.logger.error("Error in Rank Solutions Processor");
      this.logger.error(error);
      throw error;
    }
  }
}
