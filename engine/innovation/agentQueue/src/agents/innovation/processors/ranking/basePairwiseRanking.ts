import { HumanChatMessage, SystemChatMessage } from "langchain/schema";
import { BaseProcessor } from "../baseProcessor.js";
import { IEngineConstants } from "../../../../constants.js";

export abstract class BasePairwiseRankingsProcessor extends BaseProcessor {
  prompts: number[][] = [];
  allItems:
    | SerpOrganicResult[]
    | IEngineSolution[]
    | IEngineProblemStatement[]
    | IEngineAffectedEntity[]
    | string[]
    | undefined;
  INITIAL_ELO_RATING: number = 1000;
  K_FACTOR_INITIAL: number = 60;  // Initial K-factor
  K_FACTOR_MIN: number = 10;  // Minimum K-factor
  NUM_COMPARISONS_FOR_MIN_K: number = 30;  // Number of comparisons for K to reach its minimum
  maxNumberOfPrompts: number = 750;

  numComparisons: Record<number, number> = {};
  KFactors: Record<number, number> = {};
  eloRatings: Record<number, number> = {};

  setupRankingPrompts(
    allItems:
      | SerpOrganicResult[]
      | IEngineSolution[]
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
      this.eloRatings[i] = this.INITIAL_ELO_RATING;

      this.numComparisons[i] = 0;  // Initialize number of comparisons
      this.KFactors[i] = this.K_FACTOR_INITIAL;  // Initialize K-factor
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

  getUpdatedKFactor(numComparisons: number) {
    // Linearly decrease K-factor from K_FACTOR_INITIAL to K_FACTOR_MIN
    if (numComparisons >= this.NUM_COMPARISONS_FOR_MIN_K) {
      return this.K_FACTOR_MIN;
    } else {
      return this.K_FACTOR_INITIAL - (this.K_FACTOR_INITIAL - this.K_FACTOR_MIN) * numComparisons / this.NUM_COMPARISONS_FOR_MIN_K;
    }
  }

  async performPairwiseRanking() {
    for (let p = 0; p < this.prompts.length; p++) {
      const promptPair = this.prompts[p];
      const { wonItemIndex, lostItemIndex } = await this.voteOnPromptPair(promptPair);

      if (wonItemIndex !== undefined && lostItemIndex !== undefined) {
        // Update Elo ratings
        const winnerRating = this.eloRatings[wonItemIndex];
        const loserRating = this.eloRatings[lostItemIndex];

        const expectedWin = 1.0 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));

        const winnerK = this.KFactors[wonItemIndex];
        const loserK = this.KFactors[lostItemIndex];

        const newWinnerRating = winnerRating + winnerK * (1 - expectedWin);
        const newLoserRating = loserRating + loserK * (0 - (1 - expectedWin));

        this.eloRatings[wonItemIndex] = newWinnerRating;
        this.eloRatings[lostItemIndex] = newLoserRating;

        // Update number of comparisons and K-factor for each item
        this.numComparisons[wonItemIndex] += 1;
        this.numComparisons[lostItemIndex] += 1;

        this.KFactors[wonItemIndex] = this.getUpdatedKFactor(this.numComparisons[wonItemIndex]);
        this.KFactors[lostItemIndex] = this.getUpdatedKFactor(this.numComparisons[lostItemIndex]);
      } else {
        throw new Error("Invalid won or lost item index");
      }
    }
  }

  getOrderedListOfItems(returnEloRatings: boolean = false) {
    const orderedItems = this.allItems!.map((item, index) => {
      return {
        item,
        rating: this.eloRatings[index]
      };
    });

    orderedItems.sort((a, b) => {
      return b.rating - a.rating;
    });

    const items = [];
    for (let i = 0; i < orderedItems.length; i++) {
      items.push(orderedItems[i].item);
    }

    if (returnEloRatings) {
      return orderedItems;
    } else {
      return items;
    }
  }

  async process() {
    super.process();
  }
}
