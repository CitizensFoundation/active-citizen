import { BaseProcessor } from "../baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../../constants.js";

export class CreateEntitiesProcessor extends BaseProcessor {
  async createEntities() {
    //TODO: Human review and improvements of this partly GPT-4 generated prompt
    const messages = [
      new SystemChatMessage(
        `
        You are an AI specialist trained to analyze complex problem statements and sub-problems and identify entities affected by them.
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

    this.currentSubProblemIndex = 0;

    for (
      let s = 0;
      s <
      Math.min(this.memory.subProblems.length, IEngineConstants.maxSubProblems);
      s++
    ) {
      this.memory.subProblems[s].entities = (await this.callLLM(
        "create-entities",
        IEngineConstants.createEntitiesModel,
        messages
      )) as IEngineAffectedEntity[];
      await this.saveMemory();

      this.currentSubProblemIndex!++;
    }
  }

  async process() {
    this.logger.info("Create Entities Processor");
    super.process();

    this.chat = new ChatOpenAI({
      temperature: IEngineConstants.createEntitiesModel.temperature,
      maxTokens: IEngineConstants.createEntitiesModel.maxTokens,
      modelName: IEngineConstants.createEntitiesModel.name,
      verbose: IEngineConstants.createEntitiesModel.verbose,
    });

    await this.createEntities();
  }
}
