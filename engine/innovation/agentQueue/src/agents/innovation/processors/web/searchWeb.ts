import { BaseProcessor } from "../baseProcessor.js";
import type { BaseResponse, GoogleParameters } from "serpapi";
import { getJson } from "serpapi";
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
      const params = {
        q,
        location,
        hl: "en",
        gl: "us",
        api_key: process.env.SERP_API_KEY,
      } satisfies GoogleParameters;

      const response = await getJson("google", params);
      this.logger.debug(response);
      await redis.set(redisKey, JSON.stringify(searchData));
      return response;
    }
  }

  async searchAllQueries() {
    if (this.memory.searchQueries.length === 0) {
      throw Error("No search queries to process");
    }

    for (const query of this.memory.searchQueries) {
      const generalSearchData = await this.serpApiSearch(
        query.generalSearchQuery
      );
      this.memory.searchResults.all.general.push(
        generalSearchData.organic_results as SerpOrganicResult[]
      );
      this.memory.searchResults.knowledgeGraph.general.push(
        generalSearchData.knowledge_graph as SerpKnowledgeGraph[]
      );

      const scientificSearchData = await this.serpApiSearch(
        `"arXiv" pdf ${query.scientificSearchQuery}`
      );
      this.memory.searchResults.all.scientific.push(
        scientificSearchData.organic_results as SerpOrganicResult[]
      );
      this.memory.searchResults.knowledgeGraph.scientific.push(
        scientificSearchData.knowledge_graph as SerpKnowledgeGraph[]
      );
    }

    await this.saveMemory();
  }

  async process() {
    super.process();
    this.logger.info("Search Web Processor");
    await this.searchAllQueries();
  }
}
