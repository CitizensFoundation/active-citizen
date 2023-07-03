import { BaseProcessor } from "./baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../constants.js";

export class CreateEntitiesProcessor extends BaseProcessor {
  async createEntities() {
    const chat = new ChatOpenAI({
      temperature: IEngineConstants.createEntitiesModel.temperature,
      maxTokens: IEngineConstants.createEntitiesModel.maxTokens,
      modelName: IEngineConstants.createEntitiesModel.name,
      verbose: IEngineConstants.createEntitiesModel.verbose,
    });

    //TODO: Human review and improvements of those GPT-4 generated few-shots
    const messages = [
      new SystemChatMessage(
        `
        You are an AI specialist trained to analyze complex problem statements and sub-problems and identify entities affected by them.
        Entities can range from individuals, groups, systems, to the planet or even inanimate objects.

        Adhere to the following guidelines:

        1. Delineate all entities impacted by the main problem and its sub-problems.
        2. Ensure entity names are concise, consistent, and succinct.
        3. Avoid coupling two entities with 'and'; each should stand alone.
        4. Initiate both 'entityName' and 'reason' with an uppercase letter.
        5. Restrict 'reason' to the effects on the entity, excluding solution suggestions. It should be a brief two to three sentence analysis of how the sub-problem influences the entity.
        6. Include Earths climate and ecology except if no reasons for them.
        7. For each entity, review all sub-problems and provide an output in the following format: [ { entityName: name, negativeEffects: [{ subProblemIndex, reason }], positiveEffects: [{ subProblemIndex, reason }] } ].
        8. Ensure a methodical, step-by-step approach to capture all affected entities.        `
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

    this.memory.entities = await this.callLLMAndSave(
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
