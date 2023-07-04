import weaviate, { WeaviateClient } from "weaviate-ts-client";
import { Base } from "../../../base";

export class WebPageVectorStore extends Base {
  client: WeaviateClient = weaviate.client({
    scheme: process.env.WEAVIATE_HTTP_SCHEME || "http",
    host: process.env.WEAVIATE_HOST || "localhost:8085",
  });

  async postWebPage(webPageAnalysis: IEngineWebPageAnalysisData) {
    return new Promise((resolve, reject) => {
      this.client.data
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
}
