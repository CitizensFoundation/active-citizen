import { BaseProcessor } from "./baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../constants.js";
import { BasePairwiseRankingsProcessor } from "./basePairwiseRanking.js";

export class RankSubProblemsProcessor extends BasePairwiseRankingsProcessor {
  problemSubProblemIndex = 0;

  async voteOnPromptPair(
    promptPair: number[]
  ): Promise<IEnginePairWiseVoteResults> {
    const itemOneIndex = promptPair[0];
    const itemTwoIndex = promptPair[1];

    const itemOne = this.allItems![itemOneIndex] as IEngineAffectedEntity;
    const itemTwo = this.allItems![itemTwoIndex] as IEngineAffectedEntity;

    let itemOneTitle = itemOne.name;
    let itemOneEffects = this.renderEntityPosNegReasons(itemOne);

    let itemTwoTitle = itemTwo.name;
    let itemTwoEffects = this.renderEntityPosNegReasons(itemTwo);

    const messages = [
      new SystemChatMessage(
        `
        You are an expert trained to analyse complex problem statements and sub-problems to rank affected entities.

        Adhere to the following guidelines:
        1. You will see a problem statement with a sub problem.
        2. You will see two entities and how they are affected. One is marked as "Entity One" and the other as "Entity Two".
        3. You will analyse, compare and rank those two entities and vote on which one is more relevant and important as an affected entity.
        4. Use negative or positive effects as a consideration in your ranking, if available.
        5. You will only output the winning item as: "One" or "Two" without an explanation.
        6. Ensure a methodical, step-by-step approach.        `
      ),
      new HumanChatMessage(
        `
         ${this.renderProblemStatement()}

         ${this.renderSubProblem(this.currentSubProblemIndex!)}

         Entities to vote on:

         Entity One:
         ${itemOneTitle}
         ${itemOneEffects}

         Entity Two:
         ${itemTwoTitle}
         ${itemTwoEffects}

         The winning entity is:
       `
      ),
    ];

    return await this.getResultsFromLLM(
      "rank-entities",
      IEngineConstants.entitiesRankingsModel,
      messages,
      itemOneIndex,
      itemTwoIndex
    );
  }

  async process() {
    this.logger.info("Rank Entities Processor");
    super.process();

    this.chat = new ChatOpenAI({
      temperature: IEngineConstants.entitiesRankingsModel.temperature,
      maxTokens: IEngineConstants.entitiesRankingsModel.maxTokens,
      modelName: IEngineConstants.entitiesRankingsModel.name,
      verbose: IEngineConstants.entitiesRankingsModel.verbose,
    });

    this.currentSubProblemIndex = 0;

    for (
      let s = 0;
      s <
      Math.min(this.memory.subProblems.length, IEngineConstants.maxSubProblems);
      s++
    ) {

      const filteredEntities = this.memory.subProblems[s].entities.filter(
        (entity) => {
          return (
            (entity.positiveEffects && entity.positiveEffects.length > 0) ||
            (entity.negativeEffects && entity.negativeEffects.length > 0)
          );
        }
      );

      this.setupPrompts(filteredEntities);
      await this.performPairwiseRanking();

      this.memory.subProblems[s].entities =
        this.getOrderedListOfItems() as IEngineAffectedEntity[];

      await this.saveMemory();

      this.currentSubProblemIndex!++;
    }
  }
}
