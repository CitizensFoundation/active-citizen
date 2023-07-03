import { Job } from "bullmq";
import { Base } from "../../../base";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { IEngineConstants } from "../../../constants";

const Redis = require("ioredis");
const redis = new Redis(process.env.REDIS_MEMORY_URL || undefined);

export abstract class BaseProcessor extends Base {
  memory!: IEngineInnovationMemoryData;
  job!: Job;
  chat: ChatOpenAI | undefined;

  constructor(job: Job, memory: IEngineInnovationMemoryData) {
    super();
    this.job = job;
    this.memory = memory;
  }

  async process() {
    if (!this.memory) {
      this.logger.error("Memory is not initialized");
      throw new Error("Memory is not initialized");
    }
  }

  async saveMemory() {
    await redis.set(this.memory.id, JSON.stringify(this.memory));
  }

  renderSubProblems() {
    return `
    ${this.memory.problemStatement.subProblems.map((subProblem, index) => {
      return `
      ${index + 1}. ${subProblem.title}\n
      ${subProblem.description}\n
      `;
    })}`;
  }

  async callLLMAndSave(
    stage: IEngineStageTypes,
    //TODO: Fix any
    modelConstant: any,
    messages: (SystemChatMessage | HumanChatMessage)[]
  ) {
    try {
      const response = await this.chat?.call(messages);

      if (response) {
        this.logger.debug(response);

        const tokensIn = await this.chat!.getNumTokensFromMessages(messages);
        const tokensOut = await this.chat!.getNumTokensFromMessages([response]);

        this.memory.stages[stage] = {
          tokensIn: tokensIn.totalCount,
          tokensOut: tokensOut.totalCount,
          tokensInCost: tokensIn.totalCount * modelConstant.inTokenCostUSD,
          tokensOutCost: tokensOut.totalCount * modelConstant.outTokenCostUSD,
        };

        await this.saveMemory();

        //TODO: Look into using StructuredOutputParser
        return JSON.parse(response.text.trim());
      } else {
        throw new Error("callLLMAndSave response was empty");
      }
    } catch (error) {
      throw error;
    }
  }
}
