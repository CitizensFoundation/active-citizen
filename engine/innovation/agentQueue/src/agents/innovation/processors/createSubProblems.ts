import { BaseProcessor } from "./baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../constants.js";

export class CreateSubProblemsProcessor extends BaseProcessor {
  async createSubProblems() {
    const chat = new ChatOpenAI({
      temperature: IEngineConstants.createSubProblemsModel.temperature,
      maxTokens: IEngineConstants.createSubProblemsModel.maxTokens,
      modelName: IEngineConstants.createSubProblemsModel.name,
      verbose: IEngineConstants.createSubProblemsModel.verbose,
    });

    //TODO: Human review and improvements of those GPT-4 generated few-shots
    const messages = [
      new SystemChatMessage(
        `
          You are an AI assistant with expertise in analyzing problem statements and generating sub-problems.
          Your task is to create sevent succinct sub-problems for any given problem statement and present them as a JSON array.
          You are programmed to strictly output the sub-problems in this format and nothing else.
          Never output anything else than the JSON array.
          Your approach to this task should be systematic and detailed and you think step-by-step.

          Examples:

          Problem Statement:
          "Increasing obesity rates in a mid-sized urban population"

          Output:
          [
            {
              "title": "Poor Nutritional Awareness",
              "description": "Many people do not understand the nutritional content of the food they consume."
            },
            {
              "title": "Limited Access to Healthy Foods",
              "description": "There are food deserts in the city, where fresh and healthy food is not readily available."
            },
            {
              "title": "Lack of Physical Activity",
              "description": "Sedentary lifestyles contribute to obesity rates."
            },
            {
              "title": "Environmental Factors",
              "description": "The city lacks safe, accessible spaces for outdoor physical activity."
            },
            {
              "title": "Socioeconomic Factors",
              "description": "Lower income households may struggle to afford healthier food options and gym memberships."
            },
            {
              "title": "Education and Outreach",
              "description": "There may be a lack of effective health education programs in schools and communities."
            },
            {
              "title": "Policy and Legislation",
              "description": "Current policies may not support healthy lifestyles or food choices."
            }
          ]

          Problem Statement:
          "Declining local biodiversity in a mid-sized coastal town due to urban development."

          Output:
          [
            {
              "title": "Habitat Destruction",
              "description": "New developments are removing natural habitats for local species."
            },
            {
              "title": "Pollution",
              "description": "Construction and human activities are leading to water, air, and soil pollution."
            },
            {
              "title": "Climate Change Impacts",
              "description": "Rising temperatures and sea levels affect local ecosystems."
            },
            {
              "title": "Invasive Species",
              "description": "Non-native species can out-compete local species and disrupt the ecosystem."
            },
            {
              "title": "Overexploitation",
              "description": "Overfishing or overhunting can deplete local species."
            },
            {
              "title": "Lack of Awareness",
              "description": "The community may not understand the importance of biodiversity."
            },
            {
              "title": "Policy and Legislation",
              "description": "Current regulations may not adequately protect local biodiversity."
            }
          ]

          Problem Statement:
          "Increasing high school dropout rates in a mid-sized city school district"

          Output:
          [
            {
              "title": "Academic Challenges",
              "description": "Many students struggle with academic subjects and do not receive adequate help."
            },
            {
              "title": "Lack of Engagement",
              "description": "School curriculum and activities may not engage students, making them less motivated to stay in school."
            },
            {
              "title": "Socioeconomic Factors",
              "description": "Students from low-income families may need to work instead of attending school."
            },
            {
              "title": "Family Issues",
              "description": "Unstable or unsupportive home environments can affect school attendance and performance."
            },
            {
              "title": "School Environment",
              "description": "Schools may lack resources or have issues with bullying or safety that discourage attendance."
            },
            {
              "title": "Lack of Future Orientation",
              "description": "Students may not see the value of a high school diploma for their future career prospects."
            },
            {
              "title": "Policy and Legislation",
              "description": "Education policies may not adequately address dropout prevention and intervention."
            }
          ]

          Problem Statement:
          "Improving the efficiency and accuracy of patient record management in a mid-sized hospital"
          [
            {
              "title": "Information Consolidation",
              "description": "Patient data is scattered across multiple systems, making it difficult to access and update."
            },
            {
              "title": "Interoperability",
              "description": "Different systems used in the hospital may not communicate effectively with each other."
            },
            {
              "title": "Data Accuracy",
              "description": "Errors may occur during the manual input of patient data."
            },
            {
              "title": "Security and Privacy",
              "description": "Protecting patient data from breaches and ensuring compliance with regulations like HIPAA."
            },
            {
              "title": "Ease of Use",
              "description": "The user interface of the existing systems may not be intuitive, leading to inefficiencies and errors."
            },
            {
              "title": "Staff Training",
              "description": "Ensuring all relevant staff are adequately trained to use the patient record management system effectively."
            },
            {
              "title": "Budget Constraints",
              "description": "The hospital may have limited resources to invest in new systems or upgrades."
            }
          ]`
      ),
      new HumanChatMessage(
        `
         Problem statement:
         "${this.memory.problemStatement.description}"

         Output:
       `
      ),
    ];

    this.memory.problemStatement.subProblems = await this.callLLMAndSave(
      "create-sub-problems",
      IEngineConstants.createSubProblemsModel,
      messages
    );

    await this.saveMemory();
  }

  async process() {
    super.process();
    this.logger.info("Sub Problems Processor");
    await this.createSubProblems();
  }
}
