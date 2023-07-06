import { BaseProcessor } from "../baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../../constants.js";

export class CreateEntitiesProcessor extends BaseProcessor {
  async renderRefinePrompt(results: IEngineAffectedEntity[]) {
    const messages = [
      new SystemChatMessage(
        `
        You are an AI expert trained to refine already generated entities affected by complex problem statements with a sub problem.
        Entities can range from individuals, groups, systems, to the planet or even inanimate objects.

        Adhere to the following guidelines:

        1. Your task is to refine entities and the negative and positive effects in relation to the problem statement and sub problem.
        2. Ensure entity names are short, concise, consistent, and succinct.
        3. Restrict positive and negative effects to the effects on the entity, excluding solution suggestions. It should be a brief two to four sentence analysis of how the sub problem affects the entity.
        4. Never output in markdown format.
        5. Expand on the reasons for the negative and positive effects if needed to make it more clear.
        6. Do the entities include the most important negative and positive effects? If not add those.
        7. Think step by step.
        `
      ),
      new HumanChatMessage(
        `
         ${this.renderProblemStatement()}

         ${this.renderSubProblem(this.currentSubProblemIndex!)}

         Previous Entities JSON Output To Review and Refine:
         ${JSON.stringify(results, null, 2)}

         New Refined Entities JSON Output:
       `
      ),
    ];
    return messages;
  }

  async renderCreatePrompt() {
    const messages = [
      new SystemChatMessage(
        `
        You are an AI expert trained to identify entities affected by complex problem statements and sub problems.
        Entities can range from individuals, groups, systems, to the planet or even inanimate objects.

        Adhere to the following guidelines:

        1. Always generate and output up to ${IEngineConstants.maxNumberGeneratedOfEntities} entities that are affected.
        2. Output all entities impacted by the main problem and its sub-problem.
        3. Output all direct negative effects, and positive effects, if any, but do not include any solutions or suggestions for solutions. You can output more than one effect in the array.
        4. Ensure entity names are short, concise, consistent, and succinct.
        5. Avoid coupling two entities with 'and'
        6. Restrict positive and negative effects to the effects on the entity, excluding solution suggestions. It should be a brief one to three sentence analysis of how the sub-problem influences the entity.
        7. Include Earths climate and ecology, separately, except if no reasons for them.
        8. Never output in markdown format.
        9. Review the problem statement and sub-problem and provide an output in the following format: [ { name: name, negativeEffects: [ reason ], positiveEffects: [ reason ] } ].
        10. Ensure a methodical, step-by-step approach to capture all affected entities.

        Example:

        Problem Statement:
        Increasing obesity rates in a mid-sized urban population

        Sub Problem:
        Poor Nutritional Awareness
        Many people do not understand the nutritional content of the food they consume.

        Entities JSON Output:
        [
            {
                "name": "Mid-sized urban population",
                "negativeEffects": ["Increased health risks due to obesity such as heart disease, diabetes, and cancer.", "Potential decrease in overall productivity due to health conditions.", "Increased healthcare costs due to obesity-related illnesses."],
                "positiveEffects": []
            },
            {
                "name": "Healthcare system",
                "negativeEffects": ["Increased burden due to higher incidence of obesity-related diseases.", "Increased costs for treating obesity and its related diseases."],
                "positiveEffects": []
            },
            {
                "name": "Local food businesses",
                "negativeEffects": ["Potential decrease in business if consumers become more health-conscious.", "Might face criticism or legal actions for contributing to unhealthy eating habits."],
                "positiveEffects": []
            },
            {
                "name": "Earth's ecology",
                "negativeEffects": ["Increased food production to cater to unhealthy diets can lead to overuse of natural resources, contributing to ecological damage."],
                "positiveEffects": []
            },
            {
                "name": "Earth's climate",
                "negativeEffects": ["Increased food production, especially meat and processed foods, contributes to greenhouse gas emissions."],
                "positiveEffects": []
            }
        ]
        `
      ),
      new HumanChatMessage(
        `
         ${this.renderProblemStatement()}

         ${this.renderSubProblem(this.currentSubProblemIndex!)}

         Entities JSON Output:
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
