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
      let queriesToSearch;
      if (searchQueryType === "general") {
        queriesToSearch = this.memory.subProblems[
          s
        ].searchQueries.generalSearchQueries.slice(
          0,
          IEngineConstants.maxTopQueriesToSearchPerType
        );
      } else if (searchQueryType === "scientific") {
        queriesToSearch = this.memory.subProblems[
          s
        ].searchQueries.scientificSearchQueries.slice(
          0,
          IEngineConstants.maxTopQueriesToSearchPerType
        );
      } else if (searchQueryType === "openData") {
        queriesToSearch = this.memory.subProblems[
          s
        ].searchQueries.openDataSearchQueries.slice(
          0,
          IEngineConstants.maxTopQueriesToSearchPerType
        );
      } else if (searchQueryType === "news") {
        queriesToSearch = this.memory.subProblems[
          s
        ].searchQueries.newsSearchQueries.slice(
          0,
          IEngineConstants.maxTopQueriesToSearchPerType
        );
      } else {
        throw new Error(`Unknown search query type: ${searchQueryType}`);
      }

      let searchResults: SerpOrganicResults = [];

      for (const query of queriesToSearch) {
        const generalSearchData = await this.serpApiSearch(query);
        searchResults = [
          ...searchResults,
          ...(generalSearchData.organic_results as SerpOrganicResults),
        ];
      }

      if (searchQueryType === "general") {
        this.memory.subProblems[s].searchResults.pages.general = searchResults;
      } else if (searchQueryType === "scientific") {
        this.memory.subProblems[s].searchResults.pages.scientific =
          searchResults;
      } else if (searchQueryType === "openData") {
        this.memory.subProblems[s].searchResults.pages.openData = searchResults;
      } else if (searchQueryType === "news") {
        this.memory.subProblems[s].searchResults.pages.news = searchResults;
      }

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
      let queriesToSearch;
      if (searchQueryType === "general") {
        queriesToSearch = this.memory.subProblems[subProblemIndex].entities[
          e
        ].searchQueries!.generalSearchQueries.slice(
          0,
          IEngineConstants.maxTopQueriesToSearchPerType
        );
      } else if (searchQueryType === "scientific") {
        queriesToSearch = this.memory.subProblems[subProblemIndex].entities[
          e
        ].searchQueries!.scientificSearchQueries.slice(
          0,
          IEngineConstants.maxTopQueriesToSearchPerType
        );
      } else if (searchQueryType === "openData") {
        queriesToSearch = this.memory.subProblems[subProblemIndex].entities[
          e
        ].searchQueries!.openDataSearchQueries.slice(
          0,
          IEngineConstants.maxTopQueriesToSearchPerType
        );
      } else if (searchQueryType === "news") {
        queriesToSearch = this.memory.subProblems[subProblemIndex].entities[
          e
        ].searchQueries!.newsSearchQueries.slice(
          0,
          IEngineConstants.maxTopQueriesToSearchPerType
        );
      } else {
        throw new Error(`Unknown search query type: ${searchQueryType}`);
      }

      let searchResults: SerpOrganicResults = [];

      for (const query of queriesToSearch) {
        const generalSearchData = await this.serpApiSearch(query);
        searchResults = [
          ...searchResults,
          ...(generalSearchData.organic_results as SerpOrganicResults),
        ];
      }

      if (searchQueryType === "general") {
        this.memory.subProblems[subProblemIndex].entities[
          e
        ].searchResults!.pages.general = searchResults;
      } else if (searchQueryType === "scientific") {
        this.memory.subProblems[subProblemIndex].entities[
          e
        ].searchResults!.pages.scientific = searchResults;
      } else if (searchQueryType === "openData") {
        this.memory.subProblems[subProblemIndex].entities[
          e
        ].searchResults!.pages.openData = searchResults;
      } else if (searchQueryType === "news") {
        this.memory.subProblems[subProblemIndex].entities[
          e
        ].searchResults!.pages.news = searchResults;
      }
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
