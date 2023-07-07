const { default: weaviate } = require('weaviate-ts-client');
import { WeaviateClient } from "weaviate-ts-client";
import { Base } from "../../../base.js";
import { IEngineConstants } from "../../../constants.js";

export class WebPageVectorStore extends Base {
  static client: WeaviateClient = weaviate.client({
    scheme: process.env.WEAVIATE_HTTP_SCHEME || "http",
    host: process.env.WEAVIATE_HOST || "localhost:8085",
  });

  async postWebPage(webPageAnalysis: IEngineWebPageAnalysisData) {
    return new Promise((resolve, reject) => {
      WebPageVectorStore.client.data
        .creator()
        .withClassName("WebPage")
        .withProperties(webPageAnalysis as any)
        .do()
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  async searchWebPages(
    query: string,
    groupId: number | undefined,
    subProblemIndex: number | undefined,
    searchType: IEngineWebPageTypes | undefined
  ): Promise<IEngineWebPageGraphQlResults> {
    //TODO: Fix any here
    const where: any[] = [];

    if (groupId) {
      where.push({
        path: ["groupId"],
        operator: "Equal",
        valueInt: groupId,
      });
    }

    if (subProblemIndex) {
      where.push({
        path: ["subProblemIndex"],
        operator: "Equal",
        valueInt: subProblemIndex,
      });
    }

    if (searchType) {
      where.push({
        path: ["searchType"],
        operator: "Equal",
        valueString: searchType,
      });
    }

    let results;

    try {
      results = await WebPageVectorStore.client.graphql
        .get()
        .withClassName("WebPage")
        .withNearText({ concepts: [query] })
        .withLimit(IEngineConstants.limits.webPageVectorResultsForNewSolutions)
        .withWhere({
          operator: "And",
          operands: where,
        })
        .withFields(
          "searchType subProblemIndex summary relevanceToProblem \
          possibleSolutionsToProblem url allRelevantParagraphs tags entities \
          _additional { distance }"
        )
        .do();
    } catch (err) {
      throw err;
    }

    return results as IEngineWebPageGraphQlResults;
  }
}
