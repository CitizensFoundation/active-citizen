import { BaseProcessor } from "../baseProcessor.js";
import type { BaseResponse, GoogleParameters } from "serpapi";
import { getJson } from "serpapi";
import { IEngineConstants } from "../../../../constants.js";
const Redis = require("ioredis");
const redis = new Redis(process.env.REDIS_MEMORY_URL || undefined);

export class SearchWebProcessor extends BaseProcessor {
  async serpApiSearch(
    q: string,
    location: string = "New York, New York"
  ): Promise<BaseResponse<GoogleParameters>> {
    const redisKey = `s_web_v1:${q}`;

    const searchData: BaseResponse<GoogleParameters> = await redis.get(
      redisKey
    );

    if (searchData) {
      this.logger.debug(`Using cached search data for ${q}`);
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

      while (retry && retryCount < maxRetries) {
        try {
          response = await getJson("google", params);
          retry = false;
        } catch (e) {
          this.logger.error(e);
          if (retryCount < maxRetries) {
            retry = false;
            throw e;
          } else {
            await new Promise((resolve) => setTimeout(resolve, 3000));
            retryCount++;
          }
        }
      }

      if (response) {
        this.logger.debug(response);
        await redis.set(redisKey, JSON.stringify(searchData));

        return response;
      } else {
        throw new Error(`Failed to get search data for ${q}`);
      }
    }
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

      let searchResults: SerpOrganicResults = [];
      let knowledgeGraphResults: SerpKnowledgeGraph[] = [];

      for (const query of queriesToSearch) {
        const generalSearchData = await this.serpApiSearch(query);
        searchResults = [
          ...searchResults,
          ...(generalSearchData.organic_results as SerpOrganicResults),
        ];

        knowledgeGraphResults = [
          ...knowledgeGraphResults,
          ...(generalSearchData.knowledge_graph as SerpKnowledgeGraph[]),
        ];
      }

      this.memory.subProblems[s].searchResults.pages[searchQueryType] =
        searchResults;
      this.memory.subProblems[s].searchResults.knowledgeGraph[searchQueryType] =
        knowledgeGraphResults;

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

      let searchResults: SerpOrganicResults = [];
      let knowledgeGraphResults: SerpKnowledgeGraph[] = [];

      for (const query of queriesToSearch) {
        const generalSearchData = await this.serpApiSearch(query);
        searchResults = [
          ...searchResults,
          ...(generalSearchData.organic_results as SerpOrganicResults),
        ];

        knowledgeGraphResults = [
          ...knowledgeGraphResults,
          ...(generalSearchData.knowledge_graph as SerpKnowledgeGraph[]),
        ];
      }

      this.memory.subProblems[subProblemIndex].entities[e].searchResults!.pages[
        searchQueryType
      ] = searchResults;

      this.memory.subProblems[subProblemIndex].entities[
        e
      ].searchResults!.knowledgeGraph[searchQueryType] = knowledgeGraphResults;
    }
  }

  async process() {
    this.logger.info("Search Web Processor");
    super.process();

    for (const searchQueryType in [
      "general",
      "scientific",
      "openData",
      "news",
    ] as IEngineWebPageTypes[]) {
      this.processSubProblems(searchQueryType as IEngineWebPageTypes);
    }

    await this.saveMemory();
  }
}
