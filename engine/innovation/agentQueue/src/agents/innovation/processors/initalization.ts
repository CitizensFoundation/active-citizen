import { BaseProcessor } from "./baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";
import { IEngineConstants } from "../../../constants.js";

export class InitializationProcessor extends BaseProcessor {

  async generateSubProblemStatements() {
    const chat = new ChatOpenAI({
      temperature: 0.9,
      maxTokens: 256,
      modelName: IEngineConstants.subProblemsModelName,
    });

    const response = await chat.call([
      new SystemChatMessage(
        `
          You are an expert problem statement analyzer and sub problems generator.
          You always generate three short sub problems from a problem statement.
          You always output the subProblems as a string JSON array.
          Never output anything else than the JSON array.
          Think step by step and explain.

          Example:

          Problem statement:
          "I want to build a house"

          [
            "Find land to build a house",
            "Find a builder to build a house",
            "Find money to build a house"
          ]
        `
      ),
      new HumanChatMessage(
        `
          Problem statement:
          "${this.memory.problemStatement.description}"
        `),
    ]);

    const parseResponse = JSON.parse(response.text);

    this.memory.problemStatement.subProblemStatements = parseResponse;
    await this.saveMemory();
  }

  async process() {
    super.process();
    this.logger.info("InitializationProcessor");

    if (this.memory.problemStatement.subProblemStatements.length === 0) {
      await this.generateSubProblemStatements();
    }
  }
}
