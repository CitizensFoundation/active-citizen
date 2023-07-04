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
    ${this.memory.problemStatement.selectedSubProblems.map(
      (subProblem, index) => {
        return `
      ${index + 1}. ${subProblem.title}\n
      ${subProblem.description}\n
      `;
      }
    )}`;
  }

  renderProblemStatement() {
    return `
      Problem Statement:\n
      ${this.memory.problemStatement.description}\n
      `;
  }

  renderPromblemsWithIndexAndEntities(index: number) {
    if (index === 0) {
      return `
      Problem Statement:\n
      ${this.memory.problemStatement.description}\n
      `;
    } else {
      const subProblem =
        this.memory.problemStatement.selectedSubProblems[index - 1];
      const entitiesText = `
        ${this.memory.entities
          .map((entity) => {
            if (entity.subProblemIndex !== index - 1) {
              return "";
            } else {
              let entityEffects = ``;

              if (entity.negativeEffects && entity.negativeEffects.length > 0) {
                entityEffects += entity.negativeEffects
                  .map((negative) => `\n${negative.reason}\n`)
                  .join("");
              }

              if (entity.positiveEffects && entity.positiveEffects.length > 0) {
                entityEffects += entity.positiveEffects
                  .map((positive) => `\n${positive.reason}\n`)
                  .join("");
              }

              if (entityEffects.length > 0) {
                entityEffects = `\n${entity.entityName}\n${entityEffects}\n}`;
              }

              return entityEffects;
            }
          })
          .join("")}`;
      return `
        Problem Statement:\n
        ${this.memory.problemStatement.description}\n

        Sub Problem:\n
        ${subProblem.description}\n

        ${entitiesText ? `Entities:\n${entitiesText}` : ""}
      `;
    }
  }

  async callLLM(
    stage: IEngineStageTypes,
    modelConstants: IEngineBaseAIModelConstants,
    messages: (SystemChatMessage | HumanChatMessage)[],
    parseJson = true
  ) {
    try {
      const response = await this.chat?.call(messages);

      if (response) {
        this.logger.debug(response);

        const tokensIn = await this.chat!.getNumTokensFromMessages(messages);
        const tokensOut = await this.chat!.getNumTokensFromMessages([response]);

        if (this.memory.stages[stage].tokensIn === undefined) {
          this.memory.stages[stage].tokensIn = 0;
          this.memory.stages[stage].tokensOut = 0;
          this.memory.stages[stage].tokensInCost = 0;
          this.memory.stages[stage].tokensOutCost = 0;
        }

        this.memory.stages[stage].tokensIn! += tokensIn.totalCount;
        this.memory.stages[stage].tokensOut! += tokensOut.totalCount;
        this.memory.stages[stage].tokensInCost! +=
          tokensIn.totalCount * modelConstants.inTokenCostUSD;
        this.memory.stages[stage].tokensOutCost! +=
          tokensOut.totalCount * modelConstants.outTokenCostUSD;

        await this.saveMemory();

        if (parseJson) {
          //TODO: Look into using StructuredOutputParser
          return JSON.parse(response.text.trim());
        } else {
          return response.text.trim();
        }
      } else {
        throw new Error("callLLM response was empty");
      }
    } catch (error) {
      throw error;
    }
  }
}
