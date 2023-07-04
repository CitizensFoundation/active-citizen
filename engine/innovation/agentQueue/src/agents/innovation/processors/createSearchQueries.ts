import { BaseProcessor } from "./baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../constants.js";

export class CreateSearchQueriesProcessor extends BaseProcessor {

  //TODO: Look into also creating search queries for the entities
  async createSearchQueries() {
    this.chat = new ChatOpenAI({
      temperature: IEngineConstants.createSearchQueriesModel.temperature,
      maxTokens: IEngineConstants.createSearchQueriesModel.maxTokens,
      modelName: IEngineConstants.createSearchQueriesModel.name,
      verbose: IEngineConstants.createSearchQueriesModel.verbose,
    });

    //TODO: Human review and improvements of this partly GPT-4 generated prompt
    const messages = [
      new SystemChatMessage(
        `
        You are an expert trained to analyse complex problem statements and sub-problems and then generate search queries to find solutions to the main problem statement and each sub-problem.

        Adhere to the following guidelines:
        1. Search queries should be concise, consistent, and succinct. They will be used to search on Google or Bing.
        2. You create two types of search queries: general and scientific.
        3. Include the subProblemIndex and use 0 as an index for solution search queries for the main problem.
        4. All search queries should be solution focused, let's find the solutions to those imporant problems.
        5. For the main problem and all sub-problems, generate the search queries, provide an output in the following format:
          [ { subProblemIndex, generalSearchQuery, scientificSearchQuery } ].
        6. Ensure a methodical, step-by-step approach to create the best possible search queries.        `
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

    this.memory.searchQueries = await this.callLLM(
      "create-search-queries",
      IEngineConstants.createSearchQueriesModel,
      messages
    );
    await this.saveMemory();
  }

  async process() {
    super.process();
    this.logger.info("Create Search Queries Processor");
    await this.createSearchQueries();
  }
}
