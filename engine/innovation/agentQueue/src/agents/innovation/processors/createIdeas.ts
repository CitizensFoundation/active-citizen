import { BaseProcessor } from "./baseProcessor.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../constants.js";

export class CreateIdeasProcessor extends BaseProcessor {
  async createIdeas(
    subProblemIndex: number,
    generalTextContext: string,
    scientificTextContext: string,
    alreadyCreatedSolutions: string | undefined = undefined
  ) {
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
        You are an expert trained to analyse complex problem statements and sub-problems to create new innovative ideas for solutions to those problems.

        Adhere to the following guidelines:
        1. Solutions should be practical, thoughtful, innovative, equitable and succinct.
        2. Output seven ideas in JSON format
        3. You should write out a short title, description, and how it can help.
        4. Solution descriptions should be at most five sentences long.
        5. Do not created the same solutions if listed under Already created solutions
        6. If entities are mentioned, they should be the ones affected by the solutions.
        7. If Text Context is available use that to inform your ideas for solutions.
        8. Never output in markdown format.
        9. For the main problem and all sub-problems, generate the search queries, provide an output in the following JSON format:
          [ { solutionTitle, solutionDescription, howCanItHelp } ].
        10. Ensure a methodical, step-by-step approach to create the best possible search queries.
        `
      ),
      new HumanChatMessage(
        `
        ${this.renderPromblemsWithIndexAndEntities(subProblemIndex)}

        Possible general context for ideas:
        ${generalTextContext}

        Possible scientific context for ideas:
        ${scientificTextContext}

        ${
          alreadyCreatedSolutions
            ? `
          Already created solutions:
          ${alreadyCreatedSolutions}
        `
            : ``
        }

        JSON Output:
       `
      ),
    ];

    const ideas = await this.callLLM(
      "create-seed-ideas",
      IEngineConstants.createSeedIdeasModel,
      messages
    );

    return ideas;
  }

  getSearchQueries(subProblemArrayIndex: number) {
    const subSearchQuery = this.memory.searchQueries.find((query) => {
      return query.subProblemIndex == subProblemArrayIndex + 1;
    });

    const generalSubSearchQueryText = subSearchQuery ? subSearchQuery.generalSearchQuery : undefined;
    const scientificSubSearchQueryText = subSearchQuery ? subSearchQuery.scientificSearchQuery : undefined;

    const problemSearchQuery = this.memory.searchQueries.find((query) => {
      return query.subProblemIndex == 0;
    });

    const generalProblemSearchQueryText = problemSearchQuery ? problemSearchQuery.generalSearchQuery : undefined;
    const scientificProblemSearchQueryText = problemSearchQuery ? problemSearchQuery.scientificSearchQuery : undefined;

    const otherSubProblemIndexes = [];

    for (let i=0;i<this.memory.problemStatement.selectedSubProblems.length;i++) {
      if (i != subProblemArrayIndex) {
        otherSubProblemIndexes.push(i+1);
      }
    }

    // TODO: Add 10% chance of other sub-problem search query


    let selectedScientificQueryText;

    if (Math.random() < 0.3 && scientificProblemSearchQueryText) {
      selectedScientificQueryText = scientificProblemSearchQueryText;
    } else {
      selectedScientificQueryText = scientificSubSearchQueryText;
    }

    let selectedGeneralQueryText;

    if (Math.random() < 0.3 && generalProblemSearchQueryText) {
      selectedGeneralQueryText = generalProblemSearchQueryText;
    } else {
      selectedGeneralQueryText = generalSubSearchQueryText;
    }
  }

  async getTextContext(subProblemArrayIndex: number) {
    const problemStatment = this.memory.problemStatement.description;
    const subProblem = this.memory.problemStatement.selectedSubProblems[subProblemArrayIndex].description;




  }



  async createAllIdeas() {
    for (
      let subProblemArrayIndex = 0;
      subProblemArrayIndex <
      this.memory.problemStatement.selectedSubProblems.length;
      subProblemArrayIndex++
    ) {
      let ideas: IEngineSolutionIdea[] = [];

      for (let i = 0; i < 4; i++) {
        let alreadyCreatedSolutions;

        if (i > 0) {
          alreadyCreatedSolutions = ideas
            .map((idea) => idea.solutionTitle)
            .join("\n");
        }

        const { generalTextContext, scientificTextContext } = await this.getTextContext(subProblemArrayIndex);

        const newIdeas = await this.createIdeas(
          i,
          generalTextContext,
          scientificTextContext,
          alreadyCreatedSolutions
        );
        ideas = ideas.concat(newIdeas);
      }
    }
  }

  async process() {
    super.process();
    this.logger.info("Create Seed Ideas Processor");
    await this.createAllIdeas();
  }
}
