import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../constants.js";
import { BasePairwiseRankingsProcessor } from "./basePairwiseRanking.js";

export class RankProsConsProcessor extends BasePairwiseRankingsProcessor {
  subProblemIndex = 0;
  currentSolutionIndex = 0;
  currentProsOrCons: "pros" | "cons" | undefined;

  getCurrentSolution() {
    if (
      this.memory.subProblems[this.subProblemIndex].solutions.populations &&
      this.memory.subProblems[this.subProblemIndex].solutions.populations.length >
        0 &&
      this.memory.subProblems[this.subProblemIndex].solutions.populations[0]
        .length > 0
    ) {
        this.memory.subProblems[this.subProblemIndex].solutions.populations[
          this.memory.subProblems[this.subProblemIndex].solutions.populations
            .length - 1
        ][
          this.currentSolutionIndex
        ];
    } else {
      return this.memory.subProblems[this.subProblemIndex].solutions.seed[
        this.currentSolutionIndex
      ];
    }
  }

  renderCurrentSolution() {
    const solution = this.getCurrentSolution()!;

    return `
      Solution:
      ${solution.title}
      ${solution.description}

    `;
  }

  async voteOnPromptPair(
    promptPair: number[]
  ): Promise<IEnginePairWiseVoteResults> {
    const itemOneIndex = promptPair[0];
    const itemTwoIndex = promptPair[1];

    const prosOrConsOne = (this.allItems![itemOneIndex] as IEngineProCon).description;
    const prosOrConsTwo = (this.allItems![itemTwoIndex] as IEngineProCon).description;

    let proConSingle;

    if (this.currentProsOrCons === "pros") {
      proConSingle = "Pro";
    } else {
      proConSingle = "Con";
    }

    const messages = [
      new SystemChatMessage(
        `
        As an AI expert, your role involves analyzing ${
          this.currentProsOrCons
        } associated with solutions to problem statements and sub-problems to decide on which ${
          this.currentProsOrCons
        } is more important.

        Please adhere to the following guidelines:

        1. You will be presented with a problem statement, a solution, and two ${
          this.currentProsOrCons
        }. These will be labeled as "${proConSingle} One" and "${proConSingle} Two".
        2. Analyze and compare the ${
          this.currentProsOrCons
        } based on their relevance and importance to the solution and choose which is more important and output your decision as either "One" or "Two".
        3. Never explain your reasoning.
        `
      ),
      new HumanChatMessage(
        `
        ${this.renderProblemStatement()}

        ${this.renderSubProblem(this.subProblemIndex)}

        ${this.renderCurrentSolution()}

        Which ${proConSingle} is more important regarding the solution above? Output your decision as either "One" or "Two".

        ${proConSingle} One: ${prosOrConsOne}

        ${proConSingle} Two: ${prosOrConsTwo}

        The more important ${proConSingle} is:
        `
      ),
    ];

    return await this.getResultsFromLLM(
      "rank-pros-cons",
      IEngineConstants.prosConsRankingsModel,
      messages,
      itemOneIndex,
      itemTwoIndex
    );
  }

  convertProsConsToObjects(prosCons: string[]): IEngineProCon[] {
    return prosCons.map((prosCon) => {
      return {
        description: prosCon
      }});
  }

  async process() {
    this.logger.info("Rank Pros Cons Processor");
    super.process();

    this.chat = new ChatOpenAI({
      temperature: IEngineConstants.prosConsRankingsModel.temperature,
      maxTokens: IEngineConstants.prosConsRankingsModel.maxOutputTokens,
      modelName: IEngineConstants.prosConsRankingsModel.name,
      verbose: IEngineConstants.prosConsRankingsModel.verbose,
    });

    try {
      for (
        let subProblemIndex = 0;
        subProblemIndex <
        Math.min(this.memory.subProblems.length, IEngineConstants.maxSubProblems);
        subProblemIndex++
      ) {
        this.subProblemIndex = subProblemIndex;

        let solutions;

        if (
          this.memory.subProblems[subProblemIndex].solutions.populations &&
          this.memory.subProblems[subProblemIndex].solutions.populations.length >
            0 &&
          this.memory.subProblems[subProblemIndex].solutions.populations[0]
            .length > 0
        ) {
          solutions =
            this.memory.subProblems[subProblemIndex].solutions.populations[
              this.memory.subProblems[subProblemIndex].solutions.populations
                .length - 1
            ];
        } else {
          solutions = this.memory.subProblems[subProblemIndex].solutions.seed;
        }

        for (
          let solutionIndex = 0;
          solutionIndex < solutions.length;
          solutionIndex++
        ) {
          this.currentSolutionIndex = solutionIndex;

          for (const prosOrCons of ["pros", "cons"] as const) {
            this.currentProsOrCons = prosOrCons;

            this.logger.debug(
              `${prosOrCons} before ranking: ${JSON.stringify(
                solutions[solutionIndex][prosOrCons]
              )}`
            );

            if (solutions[solutionIndex][prosOrCons] && solutions[solutionIndex][prosOrCons]!.length > 0) {
              const firstItem = solutions[solutionIndex][prosOrCons]![0];

              const hasStrings = typeof firstItem === "string";

              let convertedProsCons;

              if (hasStrings) {
                this.logger.debug("Converting pros/cons to objects");
                convertedProsCons = this.convertProsConsToObjects(solutions[solutionIndex][prosOrCons]! as string[]);
              } else {
                convertedProsCons = solutions[solutionIndex][prosOrCons]! as IEngineProCon[];
              }

              this.setupRankingPrompts(convertedProsCons);
              await this.performPairwiseRanking();

              if (
                this.memory.subProblems[subProblemIndex].solutions.populations &&
                this.memory.subProblems[subProblemIndex].solutions.populations
                  .length > 0 &&
                this.memory.subProblems[subProblemIndex].solutions.populations[0]
                  .length > 0
              ) {
                this.memory.subProblems[subProblemIndex].solutions.populations[
                  this.memory.subProblems[subProblemIndex].solutions.populations
                    .length - 1
                ][solutionIndex][prosOrCons] =
                  this.getOrderedListOfItems(true) as IEngineProCon[];
              } else {
                this.memory.subProblems[subProblemIndex].solutions.seed[
                  solutionIndex
                ][prosOrCons] = this.getOrderedListOfItems(true) as string[];
                this.logger.debug(
                  `${prosOrCons} after ranking: ${JSON.stringify(
                    this.memory.subProblems[subProblemIndex].solutions.seed[
                      solutionIndex
                    ][prosOrCons]
                  )}`
                );
              }
            } else {
              this.logger.error(`No ${prosOrCons} to rank`)
            }

          }
          await this.saveMemory();
        }
      }
    } catch (error) {
      this.logger.error("Error in Rank Pros Cons Processor")
      this.logger.error(error);
    }

  }
}
