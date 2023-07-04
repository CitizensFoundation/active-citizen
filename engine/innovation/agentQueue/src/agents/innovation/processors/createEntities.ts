import { BaseProcessor } from "./baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../constants.js";

export class CreateEntitiesProcessor extends BaseProcessor {
  async createEntities() {
    this.chat = new ChatOpenAI({
      temperature: IEngineConstants.createEntitiesModel.temperature,
      maxTokens: IEngineConstants.createEntitiesModel.maxTokens,
      modelName: IEngineConstants.createEntitiesModel.name,
      verbose: IEngineConstants.createEntitiesModel.verbose,
    });

    //TODO: Human review and improvements of this partly GPT-4 generated prompt
    const messages = [
      new SystemChatMessage(
        `
        You are an AI specialist trained to analyze complex problem statements and sub-problems and identify entities affected by them.
        Entities can range from individuals, groups, systems, to the planet or even inanimate objects.

        Adhere to the following guidelines:

        1. Always generate and output 21 entities that are affected.
        2. There are 7 example entities but always generate twenty one entities in your output.
        1. Delineate all entities impacted by the main problem and its sub-problems.
        2. Ensure entity names are concise, consistent, and succinct.
        3. Avoid coupling two entities with 'and'; each should stand alone.
        4. Initiate both 'name' and 'reason' with an uppercase letter.
        5. Restrict 'reason' to the effects on the entity, excluding solution suggestions. It should be a brief two to three sentence analysis of how the sub-problem influences the entity.
        6. Include Earths climate and ecology except if no reasons for them.
        7. Never output in markdown format.
        8. For each entity, review all sub-problems and provide an output in the following format: [ { name: name, negativeEffects: [{ subProblemIndex, reason }], positiveEffects: [{ subProblemIndex, reason }] } ].
        9. Ensure a methodical, step-by-step approach to capture all affected entities.

        Example:

        Problem Statement:
        Increasing obesity rates in a mid-sized urban population

        Sub Problems:
        1. Poor Nutritional Awareness
        Many people do not understand the nutritional content of the food they consume.

        2. Limited Access to Healthy Foods
        There are food deserts in the city, where fresh and healthy food is not readily available.

        3. Lack of Physical Activity
        Sedentary lifestyles contribute to obesity rates.

        4. Environmental Factors
        The city lacks safe, accessible spaces for outdoor physical activity.

        5. Socioeconomic Factors
        Lower income households may struggle to afford healthier food options and gym memberships.

        6. Education and Outreach
        There may be a lack of effective health education programs in schools and communities.

        7. Policy and Legislation
        Current policies may not support healthy lifestyles or food choices

        Entities JSON Output:
        [
          {
            "name": "Urban population",
            "negativeEffects": [
                {
                    "subProblemIndex": 1,
                    "reason": "A lack of nutritional awareness leads to individuals making poor dietary choices, contributing to obesity."
                },
                {
                    "subProblemIndex": 2,
                    "reason": "Limited access to healthy foods in certain areas of the city forces residents to rely on less nutritious options, leading to obesity."
                },
                {
                    "subProblemIndex": 3,
                    "reason": "Sedentary lifestyles, prevalent in the urban population, contribute to increased obesity rates."
                },
                {
                    "subProblemIndex": 4,
                    "reason": "A shortage of safe and accessible spaces for physical activities hinders regular exercise, contributing to obesity."
                },
                {
                    "subProblemIndex": 5,
                    "reason": "Socioeconomic constraints prevent lower-income households from accessing healthier food and fitness facilities, increasing obesity rates."
                },
                {
                    "subProblemIndex": 6,
                    "reason": "Inadequate health education programs in schools and communities lead to uninformed health choices and increase obesity rates."
                },
                {
                    "subProblemIndex": 7,
                    "reason": "Policies not supportive of healthy lifestyles or food choices make it difficult for the urban population to maintain a healthy weight."
                }
            ],
            "positiveEffects": []
          },
          {
              "name": "Earth's climate",
              "negativeEffects": [
                  {
                      "subProblemIndex": 2,
                      "reason": "Food deserts in the city might lead to an increased reliance on heavily processed and packaged foods, which can have a greater environmental footprint."
                  },
                  {
                      "subProblemIndex": 5,
                      "reason": "Socioeconomic factors can lead to a greater reliance on less environmentally friendly food sources, contributing to climate change."
                  }
              ],
              "positiveEffects": []
          },
          {
            "name": "Local health providers",
            "negativeEffects": [
                {
                    "subProblemIndex": 1,
                    "reason": "Poor nutritional awareness among the population leads to an increased burden on health providers to manage obesity-related health complications."
                },
                {
                    "subProblemIndex": 6,
                    "reason": "Insufficient health education programs could increase the pressure on health providers to educate patients on healthy habits."
                }
            ],
            "positiveEffects": []
          },
          {
              "name": "Local government",
              "negativeEffects": [
                  {
                      "subProblemIndex": 7,
                      "reason": "Inadequate policies supporting healthy lifestyles can negatively impact the public perception of the local government."
                  }
              ],
              "positiveEffects": []
          },
          {
              "name": "Local businesses",
              "negativeEffects": [
                  {
                      "subProblemIndex": 2,
                      "reason": "Limited access to healthy foods could limit the types of food-related businesses that can thrive in the city."
                  },
                  {
                      "subProblemIndex": 5,
                      "reason": "Socioeconomic factors might impact the buying power of customers, affecting local businesses, particularly those selling healthier food options."
                  }
              ],
              "positiveEffects": []
          },
          {
              "name": "Schools",
              "negativeEffects": [
                  {
                      "subProblemIndex": 1,
                      "reason": "Poor nutritional awareness can lead to unhealthy food choices among students, affecting their performance and wellbeing."
                  },
                  {
                      "subProblemIndex": 6,
                      "reason": "Lack of effective health education programs in schools could lead to a generation of students with unhealthy habits."
                  }
              ],
              "positiveEffects": []
          },
          {
              "name": "Local gyms and fitness centers",
              "negativeEffects": [
                  {
                      "subProblemIndex": 3,
                      "reason": "Lack of physical activity could indicate low attendance at local gyms and fitness centers."
                  },
                  {
                      "subProblemIndex": 5,
                      "reason": "Socioeconomic factors can affect the ability of lower income households to afford gym memberships, which might impact the business of local gyms and fitness centers."
                  }
              ],
              "positiveEffects": []
          }
        ]
        `


        ),
      new HumanChatMessage(
        `
         Problem statement:
         ${this.memory.problemStatement.description}

         Sub Problems:
         ${this.renderSubProblems()}

         Entities JSON Output:
       `
      ),
    ];

    this.memory.entities = await this.callLLM(
      "create-entities",
      IEngineConstants.createEntitiesModel,
      messages
    );
    await this.saveMemory();
  }

  async process() {
    super.process();
    this.logger.info("Create Entities Processor");
    await this.createEntities();
  }
}
