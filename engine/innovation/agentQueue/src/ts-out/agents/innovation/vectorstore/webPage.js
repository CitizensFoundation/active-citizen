"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebPageVectorStore = void 0;
const weaviate_ts_client_1 = __importDefault(require("weaviate-ts-client"));
const base_1 = require("../../../base");
const constants_1 = require("../../../constants");
class WebPageVectorStore extends base_1.Base {
    static client = weaviate_ts_client_1.default.client({
        scheme: process.env.WEAVIATE_HTTP_SCHEME || "http",
        host: process.env.WEAVIATE_HOST || "localhost:8085",
    });
    async postWebPage(webPageAnalysis) {
        return new Promise((resolve, reject) => {
            WebPageVectorStore.client.data
                .creator()
                .withClassName("WebPage")
                .withProperties(webPageAnalysis)
                .do()
                .then((res) => {
                resolve(res);
            })
                .catch((err) => {
                reject(err);
            });
        });
    }
    async searchWebPages(query, groupId, subProblemIndex, searchType) {
        //TODO: Fix any here
        const where = [];
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
                .withLimit(constants_1.IEngineConstants.limits.webPageVectorResultsForNewSolutions)
                .withWhere({
                operator: "And",
                operands: where,
            })
                .withFields("searchType subProblemIndex summary relevanceToProblem \
          possibleSolutionsToProblem url allRelevantParagraphs tags entities \
          _additional { distance }")
                .do();
        }
        catch (err) {
            throw err;
        }
        return results;
    }
}
exports.WebPageVectorStore = WebPageVectorStore;
