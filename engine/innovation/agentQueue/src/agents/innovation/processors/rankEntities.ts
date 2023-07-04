import { BaseProcessor } from "./baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../constants.js";
import { BasePairwiseRankingsProcessor } from "./basePairwiseRanking.js";

export class RankSubProblemsProcessor extends BasePairwiseRankingsProcessor {
  problemSubProblemIndex = 0;

  async voteOnPromptPair(
    promptPair: number[]
  ): Promise<{ wonItemIndex: number; lostItemIndex: number }> {
    const itemOneIndex = promptPair[0];
    const itemTwoIndex = promptPair[1];

    const itemOne = this.allItems![itemOneIndex] as IEngineAffectedEntity;
    const itemTwo = this.allItems![itemTwoIndex] as IEngineAffectedEntity;

    let itemOneTitle = itemOne.name;
    let itemOneDescription = this.renderEntityPosNegReasons(itemOne);

    let itemTwoTitle = itemTwo.name;
    let itemTwoDescription = this.renderEntityPosNegReasons(itemTwo);

    const messages = [
      new SystemChatMessage(
        `
        You are an expert trained to analyse complex problem statements and sub-problems to rank affected entities.

        Adhere to the following guidelines:
        1. You will see the problem statement with sub problems.
        2. You will see two entities and how they are affected. One is marked as "Item 1" and the other as "Item 2".
        3. You will analyse, compare and rank those two entities and vote on which one is more relevant and important as an affected entitiy.
        4. You will only output the winning item as: "Item 1" or "Item 2" without an explaination.
        5. Ensure a methodical, step-by-step approach to create the best possible search queries.        `
      ),
      new HumanChatMessage(
        `
         ${this.renderProblemStatement()}

         ${this.renderSubProblems()}

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

    const filteredEntities = this.memory.entities.all.filter((entity) => {
      return (
        (entity.positiveEffects && entity.positiveEffects.length > 0) ||
        (entity.negativeEffects && entity.negativeEffects.length > 0)
      );
    });

    if (filteredEntities.length <= 7) {
      this.memory.entities.selected = filteredEntities;
    } else {
      this.setupPrompts(filteredEntities);
      await this.performPairwiseRanking();

      this.memory.entities.selected = this.getOrderedListOfItems().slice(
        0,
        7
      ) as IEngineAffectedEntity[];

      await this.saveMemory();
    }
  }
}
