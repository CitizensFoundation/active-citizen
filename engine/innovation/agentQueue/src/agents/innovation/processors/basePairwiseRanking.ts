import { HumanChatMessage, SystemChatMessage } from "langchain/schema";
import { BaseProcessor } from "./baseProcessor.js";

export abstract class BasePairwiseRankingsProcessor extends BaseProcessor {
  prompts: number[][] = [];
  allItems:
    | SerpOrganicResult[]
    | IEngineSolutionIdea[]
    | IEngineProblemStatement[]
    | IEngineAffectedEntity[]
    | undefined;
  allItemWonVotes: Record<number, number> = {};
  allItemLostVotes: Record<number, number> = {};
  maxNumberOfPrompts: number = 100;

  setupPrompts(
    allItems:
      | SerpOrganicResult[]
      | IEngineSolutionIdea[]
      | IEngineProblemStatement[]
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
  ): Promise<{ wonItemIndex: number; lostItemIndex: number }>;

  async getResultsFromLLM(
    stageName: IEngineStageTypes,
    modelConstant: IEngineBaseAIModelConstants,
    messages: (HumanChatMessage | SystemChatMessage)[],
    itemOneIndex: number,
    itemTwoIndex: number
  ) {
    const winningItemText = await this.callLLM(
      stageName,
      modelConstant,
      messages,
      false
    );

    let wonItemIndex;
    let lostItemIndex;

    if (!winningItemText) {
      throw new Error("No winning item text");
    } else if (winningItemText.trim() == "Item 1") {
      wonItemIndex = itemOneIndex;
      lostItemIndex = itemTwoIndex;
    } else if (winningItemText.trim() == "Item 2") {
      wonItemIndex = itemTwoIndex;
      lostItemIndex = itemOneIndex;
    } else {
      throw new Error("Invalid winning item text");
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
      if (this.allItemWonVotes[wonItemIndex] === undefined) {
        this.allItemWonVotes[wonItemIndex] = 0;
      }
      this.allItemWonVotes[wonItemIndex] += 1;

      if (this.allItemLostVotes[lostItemIndex] === undefined) {
        this.allItemLostVotes[lostItemIndex] = 0;
      }
      this.allItemLostVotes[lostItemIndex] += 1;
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
