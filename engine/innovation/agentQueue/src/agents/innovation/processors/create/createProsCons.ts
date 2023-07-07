import { BaseProcessor } from "../baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../../constants.js";

export class CreateProsConsProcessor extends BaseProcessor {
  async renderRefinePrompt(prosOrCons: string, results: IEngineAffectedEntity[]) {
    const messages = [
      new SystemChatMessage(
        `
        As an AI expert, your role is to refine the ${prosOrCons} associated with solutions to a problem, its sub-problems, and any affected entities.

        Please adhere to these guidelines:

        1. Refine ${prosOrCons} to make them concise, consistent, detailed, and succinct.
        2. Consider the context provided by the problem statement, sub-problems, and affected entities.
        3. Ensure the refined ${prosOrCons} are relevant and directly applicable.
        4. Output should be in plain text, not markdown format.
        5. Maintain a step-by-step approach in your thinking.
        `
      ),
      new HumanChatMessage(
        `
         ${this.renderProblemStatement()}

         ${this.renderSubProblem(this.currentSubProblemIndex!)}

         Review and Refine the Previous JSON Output of ${prosOrCons}:
         ${JSON.stringify(results, null, 2)}

         New Refined JSON Output of ${prosOrCons}:
       `
      ),
    ];
    return messages;
  }


  async renderCreatePrompt(prosOrCons: string) {
    const messages = [
      new SystemChatMessage(
        `
        As an AI expert, your role is to generate creative and practical ${prosOrCons} for solutions to a problem, its sub-problems, and any affected entities.

        Please adhere to these guidelines:

        1. Generate and output up to ${IEngineConstants.maxNumberGeneratedProsConsForSolution} ${prosOrCons}.
        2. Ensure that each of the ${prosOrCons} is concise, consistent, detailed, and succinct.
        3. Consider the context provided by the problem statement, sub-problems, and affected entities.
        4. Make sure each ${prosOrCons} is directly applicable to the solution.
        5. Output should be in plain text, not markdown format.
        6. Format the ${prosOrCons} as an array of strings in JSON format: ['${prosOrCons}1', '${prosOrCons}2', ...].
        7. Approach this task with step-by-step reasoning.
        `
      ),
      new HumanChatMessage(
        `
         ${this.renderPromblemsWithIndexAndEntities(this.currentSubProblemIndex!)}

         JSON Output of ${prosOrCons}:
       `
      ),
    ];

    return messages;
  }


  async createEntities() {
    //TODO: Human review and improvements of this partly GPT-4 generated prompt

    this.currentSubProblemIndex = 0;

    for (
      let s = 0;
      s <
      Math.min(this.memory.subProblems.length, IEngineConstants.maxSubProblems);
      s++
    ) {
      this.currentSubProblemIndex = s;

      let results = (await this.callLLM(
        "create-entities",
        IEngineConstants.createEntitiesModel,
        await this.renderCreatePrompt()
      )) as IEngineAffectedEntity[];

      if (IEngineConstants.enable.refine.createEntities) {
        results = (await this.callLLM(
          "create-entities",
          IEngineConstants.createEntitiesModel,
          await this.renderRefinePrompt(results)
        )) as IEngineAffectedEntity[];
      }

      this.memory.subProblems[s].entities = results;

      await this.saveMemory();
    }
  }

  async process() {
    this.logger.info("Create Entities Processor");
    super.process();

    this.chat = new ChatOpenAI({
      temperature: IEngineConstants.createEntitiesModel.temperature,
      maxTokens: IEngineConstants.createEntitiesModel.maxOutputTokens,
      modelName: IEngineConstants.createEntitiesModel.name,
      verbose: IEngineConstants.createEntitiesModel.verbose,
    });

    await this.createEntities();
  }
}
