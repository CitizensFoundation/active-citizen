import { HumanChatMessage, SystemChatMessage } from "langchain/schema";
import { BaseProcessor } from "../baseProcessor.js";
import { IEngineConstants } from "../../../../constants.js";

export abstract class BasePairwiseRankingsProcessor extends BaseProcessor {
  prompts: number[][] = [];
  allItems:
    | SerpOrganicResult[]
    | IEngineSolutionIdea[]
    | IEngineProblemStatement[]
    | IEngineAffectedEntity[]
    | string[]
    | undefined;
  allItemWonVotes: Record<number, number> = {};
  allItemLostVotes: Record<number, number> = {};
  maxNumberOfPrompts: number = 100;

  setupRankingPrompts(
    allItems:
      | SerpOrganicResult[]
      | IEngineSolutionIdea[]
      | IEngineProblemStatement[]
      | string[]
      | IEngineAffectedEntity[],
    maxPrompts: number | undefined = undefined
  ) {
    this.allItems = allItems;
    this.maxNumberOfPrompts = maxPrompts || this.maxNumberOfPrompts;
    this.prompts = [];
    for (let i = 0; i < this.allItems.length; i++) {
      for (let j = i + 1; j < this.allItems.length; j++) {
        this.prompts.push([i, j]);
      }
    }

    while (this.prompts.length > this.maxNumberOfPrompts) {
      const randomIndex = Math.floor(Math.random() * this.prompts.length);
      this.prompts.splice(randomIndex, 1);
    }
  }

  abstract voteOnPromptPair(
    promptPair: number[]
  ): Promise<IEnginePairWiseVoteResults>;

  async getResultsFromLLM(
    stageName: IEngineStageTypes,
    modelConstant: IEngineBaseAIModelConstants,
    messages: (HumanChatMessage | SystemChatMessage)[],
    itemOneIndex: number,
    itemTwoIndex: number
  ) {
    let wonItemIndex;
    let lostItemIndex;

    const maxRetryCount = IEngineConstants.rankingLLMmaxRetryCount;
    let retry = true;
    let retryCount = 0;

    while (retry && retryCount < maxRetryCount) {
      try {
        const winningItemText = await this.callLLM(
          stageName,
          modelConstant,
          messages,
          false
        );

        if (!winningItemText) {
          throw new Error("No winning item text");
        } else if (winningItemText.trim() == "One") {
          wonItemIndex = itemOneIndex;
          lostItemIndex = itemTwoIndex;
        } else if (winningItemText.trim() == "Two") {
          wonItemIndex = itemTwoIndex;
          lostItemIndex = itemOneIndex;
        } else {
          throw new Error("Invalid winning item text");
        }

        retry = false;
      } catch (error) {
        this.logger.error(error);
        if (retryCount < maxRetryCount) {
          retryCount++;
        } else {
          throw error;
        }
      }
    }

    return {
      wonItemIndex,
      lostItemIndex,
    };
  }

  async performPairwiseRanking() {
    for (let p = 0; p < this.prompts.length; p++) {
      const promptPair = this.prompts[p];
      const { wonItemIndex, lostItemIndex } = await this.voteOnPromptPair(
        promptPair
      );

      if (wonItemIndex && lostItemIndex) {
        if (this.allItemWonVotes[wonItemIndex] === undefined) {
          this.allItemWonVotes[wonItemIndex] = 0;
        }
        this.allItemWonVotes[wonItemIndex] += 1;

        if (this.allItemLostVotes[lostItemIndex] === undefined) {
          this.allItemLostVotes[lostItemIndex] = 0;
        }
        this.allItemLostVotes[lostItemIndex] += 1;
      } else {
        throw new Error("Invalid won or lost item index");
      }
    }
  }

  getOrderedListOfItems() {
    const orderedItems = this.allItems!.map((item, index) => {
      return {
        item,
        wonVotes: this.allItemWonVotes[index] || 0,
        lostVotes: this.allItemLostVotes[index] || 0,
      };
    });

    orderedItems.sort((a, b) => {
      return b.wonVotes - a.wonVotes;
    });

    // Get just the items not the won and lost votes
    const items = [];
    for (let i = 0; i < orderedItems.length; i++) {
      items.push(orderedItems[i].item);
    }

    return items;
  }

  async process() {
    super.process();
  }
}
