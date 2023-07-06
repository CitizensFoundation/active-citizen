const gpt4InTokenPrice = 0.03 / 1000;
const gpt4OutTokenPrice = 0.06 / 1000;

const gpt35_16kInTokenPrice = 0.003 / 1000;
const gpt35_16kOutTokenPrice = 0.004 / 1000;

export class IEngineConstants {
  static createSubProblemsModel: IEngineBaseAIModelConstants = {
    name: "gpt-4",
    temperature: 0.9,
    maxOutputTokens: 2048,
    tokenLimit: 8192,
    inTokenCostUSD: gpt4InTokenPrice,
    outTokenCostUSD: gpt4OutTokenPrice,
    verbose: true,
  };

  static createEntitiesModel: IEngineBaseAIModelConstants = {
    name: "gpt-4",
    temperature: 0.9,
    maxOutputTokens: 2048,
    tokenLimit: 8192,
    inTokenCostUSD: gpt4InTokenPrice,
    outTokenCostUSD: gpt4OutTokenPrice,
    verbose: true,
  };

  static createSearchQueriesModel: IEngineBaseAIModelConstants = {
    name: "gpt-4",
    temperature: 0.9,
    maxOutputTokens: 1024,
    tokenLimit: 8192,
    inTokenCostUSD: gpt4InTokenPrice,
    outTokenCostUSD: gpt4OutTokenPrice,
    verbose: true,
  };

  static searchQueryRankingsModel: IEngineBaseAIModelConstants = {
    name: "gpt-4",
    temperature: 0.0,
    maxOutputTokens: 2,
    tokenLimit: 8192,
    inTokenCostUSD: gpt4InTokenPrice,
    outTokenCostUSD: gpt4OutTokenPrice,
    verbose: true,
  };

  static searchResultsRankingsModel: IEngineBaseAIModelConstants = {
    name: "gpt-4",
    temperature: 0.0,
    maxOutputTokens: 2,
    tokenLimit: 8192,
    inTokenCostUSD: gpt4InTokenPrice,
    outTokenCostUSD: gpt4OutTokenPrice,
    verbose: true,
  };

  static subProblemsRankingsModel: IEngineBaseAIModelConstants = {
    name: "gpt-4",
    temperature: 0.0,
    maxOutputTokens: 2,
    tokenLimit: 8192,
    inTokenCostUSD: gpt4InTokenPrice,
    outTokenCostUSD: gpt4OutTokenPrice,
    verbose: true,
  };

  static entitiesRankingsModel: IEngineBaseAIModelConstants = {
    name: "gpt-4",
    temperature: 0.0,
    maxOutputTokens: 2,
    tokenLimit: 8192,
    inTokenCostUSD: gpt4InTokenPrice,
    outTokenCostUSD: gpt4OutTokenPrice,
    verbose: true,
  };

  static ideasRankingsModel: IEngineBaseAIModelConstants = {
    name: "gpt-4",
    temperature: 0.0,
    maxOutputTokens: 2,
    tokenLimit: 8192,
    inTokenCostUSD: gpt4InTokenPrice,
    outTokenCostUSD: gpt4OutTokenPrice,
    verbose: true,
  };

  static getPageAnalysisModel: IEngineBaseAIModelConstants = {
    name: "gpt-3.5-turbo-16k",
    temperature: 0.0,
    maxOutputTokens: 2048,
    tokenLimit: 16385,
    inTokenCostUSD: gpt35_16kInTokenPrice,
    outTokenCostUSD: gpt35_16kOutTokenPrice,
    verbose: true,
  };

  static createSeedSolutionsModel: IEngineBaseAIModelConstants = {
    name: "gpt-4",
    temperature: 0.9,
    maxOutputTokens: 1200,
    tokenLimit: 8192,
    inTokenCostUSD: gpt4InTokenPrice,
    outTokenCostUSD: gpt4OutTokenPrice,
    verbose: true,
  };

  static getPageTimeout = 1000 * 10;

  static getPageCacheExpiration = 60 * 60 * 24 * 7 * 4 * 6; // 6 months

  static maxSubProblems = 7;

  static maxNumberGeneratedOfEntities = 7;

  static mainLLMmaxRetryCount = 3;

  static rankingLLMmaxRetryCount = 3;

  static maxTopEntitiesToSearch = 3;

  static maxTopQueriesToSearchPerType = 2;

  static mainSearchRetryCount = 3;

  static maxTopPagesToGetPerType = 3;

  static maxTopSearchQueriesForSolutionCreation = 3;

  static numberOfSearchTypes = 4;

  static chances = {
    useMainProblemSearchQueriesNewSolutions: 0.2,
    useOtherSubProblemSearchQueriesNewSolutions: 0.1,
    notUsingFirstSearchQueryForNewSolutions: 0.5,
    useMainProblemVectorSearchNewSolutions: 0.1
  }

  static limits = {
    webPageVectorResultsForNewSolutions: 10
  }

  static enable = {
    refine: {
      createSubProblems: true,
      createEntities: true,
      createSolutions: true
    }
  }

  static  = 0.5;

  static currentUserAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
}


