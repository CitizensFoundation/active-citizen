import { BaseProcessor } from "../baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../../constants.js";

export class CreateProsConsProcessor extends BaseProcessor {
  async renderRefinePrompt(prosOrCons: string, results: IEngineAffectedEntity[]) {
    const messages = [
      new SystemChatMessage(
        `
        You are an AI expert trained to refine ${prosOrCons} for solutions to a problem, its subproblems, and affected entities.

        Adhere to the following guidelines:

        1. Your task is to refine ${prosOrCons} for solutions to a problem, its subproblems, and affected entities.
        2. The ${prosOrCons} should be concise, consistent, detailed, and succinct.
        3. Consider the problem statement, subproblem, and affected entities, and refine the ${prosOrCons} to be more relevant.
        4. Do not output in markdown format. Instead, use plain text.
        5. Think step by step.
        `
      ),
      new HumanChatMessage(
        `
         ${this.renderProblemStatement()}

         ${this.renderSubProblem(this.currentSubProblemIndex!)}

         Previous ${prosOrCons} JSON Output To Review and Refine:
         ${JSON.stringify(results, null, 2)}

         New Refined ${prosOrCons} JSON Output:
       `
      ),
    ];
    return messages;
  }

  async renderCreatePrompt(prosOrCons: string) {
    const messages = [
      new SystemChatMessage(
        `
        You are an AI expert trained to create innovative and practical ${prosOrCons} for solutions to a problem, its subproblems, and affected entities.

        Adhere to the following guidelines:

        1. Always generate and output up to ${IEngineConstants.maxNumberGeneratedProsConsForSolution} ${prosOrCons} for solutions to a problem, its subproblems, and affected entities.
        2. The ${prosOrCons} should be concise, consistent, detailed, and succinct.
        3. Consider the problem statement, subproblem, and entities, and make sure the ${prosOrCons} for the solution is relevant.
        4. Do not output in markdown format. Instead, output in plain text.
        5. Always output the ${prosOrCons} as an array of strings in JSON format: ['${prosOrCons}1', '${prosOrCons}2', ...].
        6. Think step by step.
        `
      ),
      new HumanChatMessage(
        `
         ${this.renderProblemsWithIndexAndEntities(this.currentSubProblemIndex!)}

         ${prosOrCons} JSON Output:
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
