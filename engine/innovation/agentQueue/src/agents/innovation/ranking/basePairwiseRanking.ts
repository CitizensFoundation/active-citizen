import { HumanChatMessage, SystemChatMessage } from "langchain/schema";
import { BaseProcessor } from "../baseProcessor.js";
import { IEngineConstants } from "../../../constants.js";

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
  K_FACTOR_INITIAL: number = 60; // Initial K-factor
  K_FACTOR_MIN: number = 10; // Minimum K-factor
  NUM_COMPARISONS_FOR_MIN_K: number = 20; // Number of comparisons for K to reach its minimum
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

      this.numComparisons[i] = 0; // Initialize number of comparisons
      this.KFactors[i] = this.K_FACTOR_INITIAL; // Initialize K-factor
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
    this.logger.info("Getting results from LLM");
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
        } else if (
          ["Neither", "None", "Both"].indexOf(winningItemText.trim()) > -1
        ) {
          wonItemIndex = -1;
          lostItemIndex = -1;
          this.logger.warn(
            `LLM returned Neither, None or Both in pairwise ranking for prompt ${JSON.stringify(
              messages
            )}`
          );
        } else {
          this.logger.error(
            `Invalid winning item text ${winningItemText} for prompt ${JSON.stringify(
              messages
            )}`
          );
          wonItemIndex = -1;
          lostItemIndex = -1;
        }
        retry = false;
      } catch (error) {
        this.logger.error("Error getting results from LLM");
        this.logger.error(error);
        if (retryCount < maxRetryCount) {
          await new Promise((resolve) =>
            setTimeout(resolve, 4500 + retryCount * 5000)
          );
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
      return (
        this.K_FACTOR_INITIAL -
        ((this.K_FACTOR_INITIAL - this.K_FACTOR_MIN) * numComparisons) /
          this.NUM_COMPARISONS_FOR_MIN_K
      );
    }
  }

  async performPairwiseRanking() {
    this.logger.info("Performing pairwise ranking");
    try {
      for (let p = 0; p < this.prompts.length; p++) {
        this.logger.info(`Prompt ${p + 1} of ${this.prompts.length}`);
        const promptPair = this.prompts[p];
        //this.logger.debug(`Prompt pair: ${promptPair}`)
        const { wonItemIndex, lostItemIndex } = await this.voteOnPromptPair(
          promptPair
        );
        //this.logger.debug(`Won item index: ${wonItemIndex} Lost item index: ${lostItemIndex}`)
        if (wonItemIndex === -1 && lostItemIndex === -1) {
          this.logger.debug(`Draw not updating elo score for prompt ${p}`);
        } else if (wonItemIndex !== undefined && lostItemIndex !== undefined) {
          // Update Elo ratings
          const winnerRating = this.eloRatings[wonItemIndex];
          const loserRating = this.eloRatings[lostItemIndex];

          const expectedWin =
            1.0 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));

          const winnerK = this.KFactors[wonItemIndex];
          const loserK = this.KFactors[lostItemIndex];

          const newWinnerRating = winnerRating + winnerK * (1 - expectedWin);
          const newLoserRating = loserRating + loserK * (0 - (1 - expectedWin));

          this.eloRatings[wonItemIndex] = newWinnerRating;
          this.eloRatings[lostItemIndex] = newLoserRating;

          // Update number of comparisons and K-factor for each item
          this.numComparisons[wonItemIndex] += 1;
          this.numComparisons[lostItemIndex] += 1;

          this.KFactors[wonItemIndex] = this.getUpdatedKFactor(
            this.numComparisons[wonItemIndex]
          );
          this.KFactors[lostItemIndex] = this.getUpdatedKFactor(
            this.numComparisons[lostItemIndex]
          );
        } else {
          throw new Error("Invalid won or lost item index");
        }
      }
    } catch (error) {
      this.logger.error("Error performing pairwise ranking");
      // If error is object use strinigfiy in the log
      if (typeof error === "object") {
        this.logger.error(JSON.stringify(error));
      } else {
        this.logger.error(error);
      }

      throw error;
    }
  }

  getOrderedListOfItems(returnEloRatings: boolean = false) {
    this.logger.info("Getting ordered list of items");
    let allItems = this.allItems;
    if (returnEloRatings) {
      for (let i = 0; i < allItems!.length; i++) {
        (
          allItems![i] as
            | IEngineSolution
            | IEngineAffectedEntity
            | IEngineSubProblem
        ).eloScore = this.eloRatings[i];
      }
    }

    const orderedItems = allItems!.map((item, index) => {
      return {
        item,
        rating: this.eloRatings[index],
      };
    });

    orderedItems.sort((a, b) => {
      return b.rating - a.rating;
    });

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
