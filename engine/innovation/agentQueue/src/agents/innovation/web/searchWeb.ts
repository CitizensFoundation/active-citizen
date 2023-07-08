import { BaseProcessor } from "../baseProcessor.js";
import type { BaseResponse, GoogleParameters } from "serpapi";
import { getJson } from "serpapi";
import { IEngineConstants } from "../../../constants.js";
import ioredis from "ioredis";

const redis = new ioredis.default(
  process.env.REDIS_MEMORY_URL || "redis://localhost:6379"
);

export class SearchWebProcessor extends BaseProcessor {
  async serpApiSearch(
    q: string,
    location: string = "New York, New York"
  ): Promise<BaseResponse<GoogleParameters>> {
    const redisKey = `s_web_v2:${q}`;

    const searchData: BaseResponse<GoogleParameters> = (await redis.get(
      redisKey
    )) as unknown as BaseResponse<GoogleParameters>;

    if (searchData && searchData!=null && searchData.length>30) {
      this.logger.debug(`Using cached search data for ${q} ${searchData}`);
      return searchData;
    } else {
      let retry = true;
      const maxRetries = IEngineConstants.mainSearchRetryCount;
      let retryCount = 0;

      const params = {
        q,
        location,
        hl: "en",
        gl: "us",
        api_key: process.env.SERP_API_KEY,
      } satisfies GoogleParameters;

      let response;

      this.logger.debug(`Search Params: ${JSON.stringify(params, null, 2)}`);

      while (retry && retryCount < maxRetries) {
        try {
          response = await getJson("google", params);
          retry = false;
          this.logger.info("Got search data from SerpApi");
        } catch (e) {
          this.logger.error(`Failed to get search data for ${q}`)
          this.logger.error(e);
          if (retryCount < maxRetries) {
            retry = false;
            throw e;
          } else {
            await new Promise((resolve) => setTimeout(resolve, 5000+(retryCount*5000)));
            retryCount++;
          }
        }
      }

      if (response) {
        await redis.set(redisKey, JSON.stringify(searchData));
        this.logger.debug(JSON.stringify(response, null, 2));

        this.logger.debug(`Returning search data`);

        return response;
      } else {
        this.logger.error(`Failed to get search data for ${q}`);
        throw new Error(`Failed to get search data for ${q}`);
      }
    }
  }

  async getQueryResults(queriesToSearch: string[]) {
    let searchResults: SerpOrganicResults = [];
    let knowledgeGraphResults: SerpKnowledgeGraph[] = [];

    for (let q = 0; q < queriesToSearch.length; q++) {
      const generalSearchData = await this.serpApiSearch(queriesToSearch[q]);
      this.logger.debug(`Got Search Data 1: ${JSON.stringify(generalSearchData)}`);

      if (generalSearchData.organic_results) {
        searchResults = [
          ...searchResults,
          ...(generalSearchData.organic_results as SerpOrganicResults),
        ];
      } else {
        this.logger.error("No organic results");
      }

      this.logger.debug("Got Search Results 2");

      if (generalSearchData.knowledge_graph) {
        knowledgeGraphResults = [
          ...knowledgeGraphResults,
          ...(generalSearchData.knowledge_graph as SerpKnowledgeGraph[]),
        ];
      } else {
        this.logger.warn("No knowledge graph results");
      }

      this.logger.debug("Got Search Results 3");

      this.logger.debug(`Search Results: ${JSON.stringify(searchResults)}`);

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return { searchResults, knowledgeGraphResults };
  }

  async processSubProblems(searchQueryType: IEngineWebPageTypes) {
    for (
      let s = 0;
      s <
      Math.min(this.memory.subProblems.length, IEngineConstants.maxSubProblems);
      s++
    ) {
      let queriesToSearch = this.memory.subProblems[s].searchQueries[
        searchQueryType
      ].slice(0, IEngineConstants.maxTopQueriesToSearchPerType);

      const results = await this.getQueryResults(queriesToSearch);

      if (!this.memory.subProblems[s].searchResults) {
        this.memory.subProblems[s].searchResults = {
          pages: {
            general: [],
            scientific: [],
            news: [],
            openData: [],
          },
          knowledgeGraph: {
            general: [],
            scientific: [],
            news: [],
            openData: [],
          },
        };
      }

      this.memory.subProblems[s].searchResults.pages[searchQueryType] =
        results.searchResults;
      this.memory.subProblems[s].searchResults.knowledgeGraph[searchQueryType] =
        results.knowledgeGraphResults;

      await this.processEntities(s, searchQueryType);

      await this.saveMemory();
    }
  }

  async processEntities(
    subProblemIndex: number,
    searchQueryType: IEngineWebPageTypes
  ) {
    for (
      let e = 0;
      e <
      Math.min(
        this.memory.subProblems[subProblemIndex].entities.length,
        IEngineConstants.maxTopEntitiesToSearch
      );
      e++
    ) {
      let queriesToSearch = this.memory.subProblems[subProblemIndex].entities[
        e
      ].searchQueries![searchQueryType].slice(
        0,
        IEngineConstants.maxTopQueriesToSearchPerType
      );

      const results = await this.getQueryResults(queriesToSearch);

      if (!this.memory.subProblems[subProblemIndex].entities[e].searchResults) {
        this.memory.subProblems[subProblemIndex].entities[e].searchResults = {
          pages: {
            general: [],
            scientific: [],
            news: [],
            openData: [],
          },
          knowledgeGraph: {
            general: [],
            scientific: [],
            news: [],
            openData: [],
          },
        };
      }

      this.memory.subProblems[subProblemIndex].entities[e].searchResults!.pages[
        searchQueryType
      ] = results.searchResults;

      this.memory.subProblems[subProblemIndex].entities[
        e
      ].searchResults!.knowledgeGraph[searchQueryType] =
        results.knowledgeGraphResults;

      await this.saveMemory();
    }
  }

  async processProblemStatement(searchQueryType: IEngineWebPageTypes) {
    let queriesToSearch = this.memory.problemStatement.searchQueries![
      searchQueryType
    ].slice(0, IEngineConstants.maxTopQueriesToSearchPerType);

    this.logger.info("Getting search data for problem statement");

    const results = await this.getQueryResults(queriesToSearch);

    this.memory.problemStatement.searchResults!.pages[searchQueryType] =
      results.searchResults;
    this.memory.problemStatement.searchResults!.knowledgeGraph[
      searchQueryType
    ] = results.knowledgeGraphResults;

    await this.saveMemory();
  }

  async process() {
    this.logger.info("Search Web Processor");
    super.process();

    try {
      for (const searchQueryType of [
        "general",
        "scientific",
        "openData",
        "news",
      ] as const) {
        await this.processProblemStatement(searchQueryType);
        await this.processSubProblems(searchQueryType as IEngineWebPageTypes);
      }
    } catch (error) {
      this.logger.error("Error processing web search");
      this.logger.error(error);
      throw error;
    }

    await this.saveMemory();
  }
}
