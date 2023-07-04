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
        ${this.memory.entities.selected
          .map((entity) => {
            if (entity.subProblemIndex !== index - 1) {
              return "";
            } else {
              let entityEffects = this.renderEntityPosNegReasons(entity);

              if (entityEffects.length > 0) {
                entityEffects = `\n${entity.name}\n${entityEffects}\n}`;
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

  renderEntityPosNegReasons(
    item: IEngineAffectedEntity,
    subProblemIndex: number | undefined = undefined
  ) {
    let itemDescription = "";

    let positiveEffects;

    if (item.positiveEffects && item.positiveEffects.length > 0) {
      positiveEffects = item.positiveEffects.map(
        (effect) =>
          `${
            !subProblemIndex || subProblemIndex === effect.subProblemIndex
              ? effect.reason
              : ``
          }`
      );
    }

    let negativeEffects;

    if (item.negativeEffects && item.negativeEffects.length > 0) {
      negativeEffects = item.negativeEffects.map(
        (effect) =>
          `${
            !subProblemIndex || subProblemIndex === effect.subProblemIndex
              ? effect.reason
              : ``
          }`
      );
    }

    if (positiveEffects && positiveEffects.length > 0) {
      itemDescription += `
      Positive Effects:
      ${positiveEffects.join("\n")}
      `;
    }

    if (negativeEffects && negativeEffects.length > 0) {
      itemDescription += `
      Negative Effects:
      ${negativeEffects.join("\n")}
      `;
    }

    return itemDescription;
  }

  async callLLM(
    stage: IEngineStageTypes,
    modelConstants: IEngineBaseAIModelConstants,
    messages: (SystemChatMessage | HumanChatMessage)[],
    parseJson = true
  ) {
    try {
      let retryCount = 0;
      const maxRetries = 3;
      let retry = true;

      while (retry && retryCount<maxRetries && this.chat) {
        const response = await this.chat.call(messages);

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
            let parsedJson;
            try {
              parsedJson = JSON.parse(response.text.trim());
            } catch (error) {
              this.logger.error(error);
              retryCount++;
            }
            retry = false;
            return parsedJson;
          } else {
            retry = false;
            return response.text.trim();
          }
        } else {
          retry = false;
          throw new Error("callLLM response was empty");
        }
      }
    } catch (error) {
      throw error;
    }
  }
}
