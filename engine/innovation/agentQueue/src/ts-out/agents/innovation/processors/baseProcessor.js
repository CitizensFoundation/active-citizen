"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseProcessor = void 0;
const base_1 = require("../../../base");
const constants_1 = require("../../../constants");
const Redis = require("ioredis");
const redis = new Redis(process.env.REDIS_MEMORY_URL || undefined);
class BaseProcessor extends base_1.Base {
    memory;
    job;
    chat;
    currentSubProblemIndex;
    constructor(job, memory) {
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
    renderSubProblem(subProblemIndex) {
        const subProblem = this.memory.subProblems[subProblemIndex];
        return `
      Sub Problem:

      ${subProblem.title}
      ${subProblem.description}
      `;
    }
    renderSubProblems() {
        return `
      Sub Problems:
      ${this.memory.subProblems.map((subProblem, index) => {
            return `
        ${index + 1}. ${subProblem.title}\n
        ${subProblem.description}\n
        `;
        })}
   `;
    }
    renderProblemStatement() {
        return `
      Problem Statement:
      ${this.memory.problemStatement.description}
      `;
    }
    renderPromblemsWithIndexAndEntities(index) {
        if (index === 0) {
            return `
      Problem Statement:\n
      ${this.memory.problemStatement.description}\n
      `;
        }
        else {
            const subProblem = this.memory.subProblems[index - 1];
            const entitiesText = `
        ${subProblem.entities
                .map((entity) => {
                let entityEffects = this.renderEntityPosNegReasons(entity);
                if (entityEffects.length > 0) {
                    entityEffects = `\n${entity.name}\n${entityEffects}\n}`;
                }
                return entityEffects;
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
    renderEntityPosNegReasons(item) {
        let itemEffects = "";
        if (item.positiveEffects && item.positiveEffects.length > 0) {
            itemEffects += `
      Positive Effects:
      ${item.positiveEffects.join("\n")}
      `;
        }
        if (item.negativeEffects && item.negativeEffects.length > 0) {
            itemEffects += `
      Negative Effects:
      ${item.negativeEffects.join("\n")}
      `;
        }
        return itemEffects;
    }
    async callLLM(stage, modelConstants, messages, parseJson = true) {
        try {
            let retryCount = 0;
            const maxRetries = constants_1.IEngineConstants.mainLLMmaxRetryCount;
            let retry = true;
            while (retry && retryCount < maxRetries && this.chat) {
                const response = await this.chat.call(messages);
                if (response) {
                    this.logger.debug(response);
                    const tokensIn = await this.chat.getNumTokensFromMessages(messages);
                    const tokensOut = await this.chat.getNumTokensFromMessages([
                        response,
                    ]);
                    if (this.memory.stages[stage].tokensIn === undefined) {
                        this.memory.stages[stage].tokensIn = 0;
                        this.memory.stages[stage].tokensOut = 0;
                        this.memory.stages[stage].tokensInCost = 0;
                        this.memory.stages[stage].tokensOutCost = 0;
                    }
                    this.memory.stages[stage].tokensIn += tokensIn.totalCount;
                    this.memory.stages[stage].tokensOut += tokensOut.totalCount;
                    this.memory.stages[stage].tokensInCost +=
                        tokensIn.totalCount * modelConstants.inTokenCostUSD;
                    this.memory.stages[stage].tokensOutCost +=
                        tokensOut.totalCount * modelConstants.outTokenCostUSD;
                    await this.saveMemory();
                    if (parseJson) {
                        //TODO: Look into using StructuredOutputParser
                        let parsedJson;
                        try {
                            parsedJson = JSON.parse(response.text.trim());
                        }
                        catch (error) {
                            this.logger.error(error);
                        }
                        if (parsedJson) {
                            retry = false;
                            return parsedJson;
                        }
                        await new Promise((resolve) => setTimeout(resolve, 2500));
                        retryCount++;
                    }
                    else {
                        retry = false;
                        return response.text.trim();
                    }
                }
                else {
                    retry = false;
                    throw new Error("callLLM response was empty");
                }
            }
        }
        catch (error) {
            throw error;
        }
    }
}
exports.BaseProcessor = BaseProcessor;
