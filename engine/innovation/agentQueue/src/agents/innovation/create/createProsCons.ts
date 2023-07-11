import { BaseProcessor } from "../baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../constants.js";

export class CreateProsConsProcessor extends BaseProcessor {
  currentSolutionIndex = 0;

  renderCurrentSolution() {
    const solution =
      this.memory.subProblems[this.currentSubProblemIndex!].solutions.seed[
        this.currentSolutionIndex!
      ];

    return `
      Solution:

      Title: ${solution.title}
      Description: ${solution.description}

      How Solution One Can Help: ${solution.mainBenefitOfSolution}
      Main Obstacles to Solution One Adoption: ${solution.mainObstacleToSolutionAdoption}
    `;
  }

  async renderRefinePrompt(prosOrCons: string, results: string[]) {
    const messages = [
      new SystemChatMessage(
        `
        As an AI expert, it's your responsibility to refine the given ${prosOrCons} pertaining to solutions, sub-problems, and affected entities.

        Keep these guidelines in mind:

        1. Make the ${prosOrCons} concise, consistent, detailed, and succinct.
        2. Expand on the ${prosOrCons} by considering the problem statement, sub-problems, and affected entities, if needed.
        3. Contextualize the ${prosOrCons} considering the problem statement, sub-problems, and affected entities.
        4. Ensure the refined ${prosOrCons} are relevant and directly applicable.
        5. Output should be in JSON format only, not markdown.
        6. The ${prosOrCons} should be formatted as an array of strings in JSON format: [ ${prosOrCons} ].
        7. Follow a step-by-step approach in your thought process.
        `
      ),
      new HumanChatMessage(
        `
        ${this.renderPromblemsWithIndexAndEntities(
          this.currentSubProblemIndex!
        )}

        ${this.renderCurrentSolution()}

        Please review and refine the following ${prosOrCons}:
        ${JSON.stringify(results, null, 2)}

        Generate and output the new JSON for the ${prosOrCons} below:
        `
      ),
    ];
    return messages;
  }

  async renderCreatePrompt(prosOrCons: string) {
    const messages = [
      new SystemChatMessage(
        `
        As an AI expert, your task is to creatively generate practical ${prosOrCons} for the provided solutions, their associated sub-problems, and any affected entities.

        Follow these guidelines:

        1. Generate and output up to ${IEngineConstants.maxNumberGeneratedProsConsForSolution} ${prosOrCons}.
        2. Ensure that each ${prosOrCons} is concise, consistent, detailed, and succinct.
        3. The ${prosOrCons} must be in line with the context given by the problem statement, sub-problems, and affected entities.
        4. Each ${prosOrCons} should be directly applicable to the solution.
        5. Output should be in JSON format only, not markdown format.
        6. The ${prosOrCons} should be formatted as an array of strings in JSON format: [ ${prosOrCons} ].
        7. Maintain a step-by-step approach in your reasoning.
        `
      ),
      new HumanChatMessage(
        `
         ${this.renderPromblemsWithIndexAndEntities(
           this.currentSubProblemIndex!
         )}

         ${this.renderCurrentSolution()}

         Generate and output JSON for the ${prosOrCons} below:
       `
      ),
    ];

    return messages;
  }

  async createProsCons() {
    for (
      let subProblemIndex = 0;
      subProblemIndex <
      Math.min(this.memory.subProblems.length, IEngineConstants.maxSubProblems);
      subProblemIndex++
    ) {
      this.currentSubProblemIndex = subProblemIndex;

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
          let results = (await this.callLLM(
            "create-pros-cons",
            IEngineConstants.createProsConsModel,
            await this.renderCreatePrompt(prosOrCons)
          )) as string[];

          if (IEngineConstants.enable.refine.createProsCons) {
            results = (await this.callLLM(
              "create-pros-cons",
              IEngineConstants.createProsConsModel,
              await this.renderRefinePrompt(prosOrCons, results)
            )) as string[];
          }

          if (
            this.memory.subProblems[subProblemIndex].solutions.populations &&
            this.memory.subProblems[subProblemIndex].solutions.populations
              .length > 0 &&
            this.memory.subProblems[subProblemIndex].solutions.populations[0]
              .length > 0
          ) {
            solutions = this.memory.subProblems[
              subProblemIndex
            ].solutions.populations[
              this.memory.subProblems[subProblemIndex].solutions.populations
                .length - 1
            ][solutionIndex][prosOrCons] = results;
          } else {
            this.memory.subProblems[subProblemIndex].solutions.seed[
              solutionIndex
            ][prosOrCons] = results;
          }

          await this.saveMemory();
        }
      }
    }
  }

  async process() {
    this.logger.info("Create ProsCons Processor");
    super.process();

    this.chat = new ChatOpenAI({
      temperature: IEngineConstants.createProsConsModel.temperature,
      maxTokens: IEngineConstants.createProsConsModel.maxOutputTokens,
      modelName: IEngineConstants.createProsConsModel.name,
      verbose: IEngineConstants.createProsConsModel.verbose,
    });

    await this.createProsCons();
  }
}
