import { BaseProcessor } from "../baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../constants.js";
import { BasePairwiseRankingsProcessor } from "./basePairwiseRanking.js";

export class RankEntitiesProcessor extends BasePairwiseRankingsProcessor {
  subProblemIndex = 0;

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
        You are an AI expert specializing in analyzing complex problem statements, sub-problems, and ranking affected entities. Please adhere to the following guidelines:

        1. You will be provided with a problem statement followed by a sub-problem.
        2. Two entities affected by the sub-problem will be given, labelled as "Entity One" and "Entity Two".
        3. Analyze and compare the entities, and then decide which one is more significantly impacted.
        4. Consider both positive and negative impacts, if available, while ranking.
        5. Output your decision as either "One" or "Two", indicating the more affected entity. No need for any explanations.
        6. Ensure to use a systematic and step-by-step approach. Think step by step.`
      ),
      new HumanChatMessage(
        `
         ${this.renderProblemStatement()}

         ${this.renderSubProblem(this.currentSubProblemIndex!)}

         Entities for Ranking:

         Entity One:
         ${itemOneTitle}
         ${itemOneEffects}

         Entity Two:
         ${itemTwoTitle}
         ${itemTwoEffects}

         The More Affected Entity Is:
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
      maxTokens: IEngineConstants.entitiesRankingsModel.maxOutputTokens,
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

      this.setupRankingPrompts(filteredEntities);
      await this.performPairwiseRanking();

      this.memory.subProblems[s].entities =
        this.getOrderedListOfItems(true) as IEngineAffectedEntity[];

      await this.saveMemory();

      this.currentSubProblemIndex!++;
    }
  }
}