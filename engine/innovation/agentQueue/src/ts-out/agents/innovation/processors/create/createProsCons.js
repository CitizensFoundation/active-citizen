"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateProsConsProcessor = void 0;
const baseProcessor_js_1 = require("../baseProcessor.js");
const openai_1 = require("langchain/chat_models/openai");
const schema_1 = require("langchain/schema");
const constants_js_1 = require("../../../../constants.js");
class CreateProsConsProcessor extends baseProcessor_js_1.BaseProcessor {
    currentSolutionIndex = 0;
    renderCurrentSolution() {
        const solution = this.memory.subProblems[this.currentSubProblemIndex].solutions.seed[this.currentSolutionIndex];
        return `
      Solution:

      Title: ${solution.title}
      Description: ${solution.description}

      How Solution One Can Help: ${solution.howCanSolutionHelp}
      Main Obstacles to Solution One Adoption: ${solution.mainObstacleToSolutionAdoption}
    `;
    }
    async renderRefinePrompt(prosOrCons, results) {
        const messages = [
            new schema_1.SystemChatMessage(`
        As an AI expert, it's your responsibility to refine the given ${prosOrCons} pertaining to solutions, sub-problems, and affected entities.

        Keep these guidelines in mind:

        1. Make the ${prosOrCons} concise, consistent, detailed, and succinct.
        2. Expand on the ${prosOrCons} by considering the problem statement, sub-problems, and affected entities, if needed.
        3. Contextualize the ${prosOrCons} considering the problem statement, sub-problems, and affected entities.
        4. Ensure the refined ${prosOrCons} are relevant and directly applicable.
        5. Output should be in JSON format only, not markdown.
        6. The ${prosOrCons} should be formatted as an array of strings in JSON format: [ ${prosOrCons} ].
        7. Follow a step-by-step approach in your thought process.
        `),
            new schema_1.HumanChatMessage(`
        ${this.renderPromblemsWithIndexAndEntities(this.currentSubProblemIndex)}

        ${this.renderCurrentSolution()}

        Please review and refine the following ${prosOrCons}:
        ${JSON.stringify(results, null, 2)}

        Generate and output the new JSON for the ${prosOrCons} below:
        `),
        ];
        return messages;
    }
    async renderCreatePrompt(prosOrCons) {
        const messages = [
            new schema_1.SystemChatMessage(`
        As an AI expert, your task is to creatively generate practical ${prosOrCons} for the provided solutions, their associated sub-problems, and any affected entities.

        Follow these guidelines:

        1. Generate and output up to ${constants_js_1.IEngineConstants.maxNumberGeneratedProsConsForSolution} ${prosOrCons}.
        2. Ensure that each ${prosOrCons} is concise, consistent, detailed, and succinct.
        3. The ${prosOrCons} must be in line with the context given by the problem statement, sub-problems, and affected entities.
        4. Each ${prosOrCons} should be directly applicable to the solution.
        5. Output should be in JSON format only, not markdown format.
        6. The ${prosOrCons} should be formatted as an array of strings in JSON format: [ ${prosOrCons} ].
        7. Maintain a step-by-step approach in your reasoning.
        `),
            new schema_1.HumanChatMessage(`
         ${this.renderPromblemsWithIndexAndEntities(this.currentSubProblemIndex)}

         ${this.renderCurrentSolution()}

         Generate and output JSON for the ${prosOrCons} below:
       `),
        ];
        return messages;
    }
    async createProsCons() {
        for (let subProblemIndex = 0; subProblemIndex <
            Math.min(this.memory.subProblems.length, constants_js_1.IEngineConstants.maxSubProblems); subProblemIndex++) {
            this.currentSubProblemIndex = subProblemIndex;
            let solutions;
            if (this.memory.subProblems[subProblemIndex].solutions.populations &&
                this.memory.subProblems[subProblemIndex].solutions.populations.length >
                    0 &&
                this.memory.subProblems[subProblemIndex].solutions.populations[0]
                    .length > 0) {
                solutions =
                    this.memory.subProblems[subProblemIndex].solutions.populations[this.memory.subProblems[subProblemIndex].solutions.populations
                        .length - 1];
            }
            else {
                solutions = this.memory.subProblems[subProblemIndex].solutions.seed;
            }
            for (let solutionIndex = 0; solutionIndex < solutions.length; solutionIndex++) {
                this.currentSolutionIndex = solutionIndex;
                for (const prosOrCons of ["pros", "cons"]) {
                    let results = (await this.callLLM("create-pros-cons", constants_js_1.IEngineConstants.createProsConsModel, await this.renderCreatePrompt(prosOrCons)));
                    if (constants_js_1.IEngineConstants.enable.refine.createProsCons) {
                        results = (await this.callLLM("create-pros-cons", constants_js_1.IEngineConstants.createProsConsModel, await this.renderRefinePrompt(prosOrCons, results)));
                    }
                    if (this.memory.subProblems[subProblemIndex].solutions.populations &&
                        this.memory.subProblems[subProblemIndex].solutions.populations
                            .length > 0 &&
                        this.memory.subProblems[subProblemIndex].solutions.populations[0]
                            .length > 0) {
                        solutions = this.memory.subProblems[subProblemIndex].solutions.populations[this.memory.subProblems[subProblemIndex].solutions.populations
                            .length - 1][solutionIndex][prosOrCons] = results;
                    }
                    else {
                        this.memory.subProblems[subProblemIndex].solutions.seed[solutionIndex][prosOrCons] = results;
                    }
                    await this.saveMemory();
                }
            }
        }
    }
    async process() {
        this.logger.info("Create ProsCons Processor");
        super.process();
        this.chat = new openai_1.ChatOpenAI({
            temperature: constants_js_1.IEngineConstants.createProsConsModel.temperature,
            maxTokens: constants_js_1.IEngineConstants.createProsConsModel.maxOutputTokens,
            modelName: constants_js_1.IEngineConstants.createProsConsModel.name,
            verbose: constants_js_1.IEngineConstants.createProsConsModel.verbose,
        });
        await this.createProsCons();
    }
}
exports.CreateProsConsProcessor = CreateProsConsProcessor;
