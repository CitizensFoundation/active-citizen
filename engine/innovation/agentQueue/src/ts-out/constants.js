const gpt4InTokenPrice = 0.03 / 1000;
const gpt4OutTokenPrice = 0.06 / 1000;
const gpt35_16kInTokenPrice = 0.003 / 1000;
const gpt35_16kOutTokenPrice = 0.004 / 1000;
export class IEngineConstants {
    static createSubProblemsModel = {
        name: "gpt-4",
        temperature: 0.9,
        maxOutputTokens: 2048,
        tokenLimit: 8192,
        inTokenCostUSD: gpt4InTokenPrice,
        outTokenCostUSD: gpt4OutTokenPrice,
        verbose: true,
    };
    static createEntitiesModel = {
        name: "gpt-4",
        temperature: 0.9,
        maxOutputTokens: 2048,
        tokenLimit: 8192,
        inTokenCostUSD: gpt4InTokenPrice,
        outTokenCostUSD: gpt4OutTokenPrice,
        verbose: true,
    };
    static createSearchQueriesModel = {
        name: "gpt-4",
        temperature: 0.9,
        maxOutputTokens: 1024,
        tokenLimit: 8192,
        inTokenCostUSD: gpt4InTokenPrice,
        outTokenCostUSD: gpt4OutTokenPrice,
        verbose: true,
    };
    static searchQueryRankingsModel = {
        name: "gpt-4",
        temperature: 0.0,
        maxOutputTokens: 2,
        tokenLimit: 8192,
        inTokenCostUSD: gpt4InTokenPrice,
        outTokenCostUSD: gpt4OutTokenPrice,
        verbose: false,
    };
    static searchResultsRankingsModel = {
        name: "gpt-4",
        temperature: 0.0,
        maxOutputTokens: 2,
        tokenLimit: 8192,
        inTokenCostUSD: gpt4InTokenPrice,
        outTokenCostUSD: gpt4OutTokenPrice,
        verbose: false,
    };
    static subProblemsRankingsModel = {
        name: "gpt-4",
        temperature: 0.0,
        maxOutputTokens: 2,
        tokenLimit: 8192,
        inTokenCostUSD: gpt4InTokenPrice,
        outTokenCostUSD: gpt4OutTokenPrice,
        verbose: true,
    };
    static entitiesRankingsModel = {
        name: "gpt-4",
        temperature: 0.0,
        maxOutputTokens: 2,
        tokenLimit: 8192,
        inTokenCostUSD: gpt4InTokenPrice,
        outTokenCostUSD: gpt4OutTokenPrice,
        verbose: true,
    };
    static solutionsRankingsModel = {
        name: "gpt-4",
        temperature: 0.0,
        maxOutputTokens: 2,
        tokenLimit: 8192,
        inTokenCostUSD: gpt4InTokenPrice,
        outTokenCostUSD: gpt4OutTokenPrice,
        verbose: true,
    };
    static prosConsRankingsModel = {
        name: "gpt-4",
        temperature: 0.0,
        maxOutputTokens: 2,
        tokenLimit: 8192,
        inTokenCostUSD: gpt4InTokenPrice,
        outTokenCostUSD: gpt4OutTokenPrice,
        verbose: true,
    };
    static getPageAnalysisModel = {
        name: "gpt-3.5-turbo-16k",
        temperature: 0.0,
        maxOutputTokens: 2048,
        tokenLimit: 16385,
        inTokenCostUSD: gpt35_16kInTokenPrice,
        outTokenCostUSD: gpt35_16kOutTokenPrice,
        verbose: false,
    };
    static createSeedSolutionsModel = {
        name: "gpt-4",
        temperature: 0.9,
        maxOutputTokens: 1200,
        tokenLimit: 8192,
        inTokenCostUSD: gpt4InTokenPrice,
        outTokenCostUSD: gpt4OutTokenPrice,
        verbose: false,
    };
    static createProsConsModel = {
        name: "gpt-4",
        temperature: 0.9,
        maxOutputTokens: 2048,
        tokenLimit: 8192,
        inTokenCostUSD: gpt4InTokenPrice,
        outTokenCostUSD: gpt4OutTokenPrice,
        verbose: true,
    };
    static evolutionMutateModel = {
        name: "gpt-4",
        temperature: 1.2,
        maxOutputTokens: 1024,
        tokenLimit: 8192,
        inTokenCostUSD: gpt4InTokenPrice,
        outTokenCostUSD: gpt4OutTokenPrice,
        verbose: true,
    };
    static evolutionRecombineModel = {
        name: "gpt-4",
        temperature: 1.0,
        maxOutputTokens: 1024,
        tokenLimit: 8192,
        inTokenCostUSD: gpt4InTokenPrice,
        outTokenCostUSD: gpt4OutTokenPrice,
        verbose: true,
    };
    static getPageTimeout = 1000 * 10;
    static getPageCacheExpiration = 60 * 60 * 24 * 7 * 4 * 6; // 6 months
    static maxSubProblems = 7;
    static maxNumberGeneratedOfEntities = 7;
    static mainLLMmaxRetryCount = 40;
    static rankingLLMmaxRetryCount = 40;
    static maxTopEntitiesToSearch = 3;
    static maxTopEntitiesToRender = 3;
    static maxTopQueriesToSearchPerType = 2;
    static mainSearchRetryCount = 40;
    static maxTopWebPagesToGet = 5;
    static maxWebPagesToGetByTopSearchPosition = 5;
    static maxTopSearchQueriesForSolutionCreation = 3;
    static maxTopProsConsUsedForRanking = 3;
    static maxNumberGeneratedProsConsForSolution = 21;
    static minSleepBeforeBrowserRequest = 1100;
    static maxAdditionalRandomSleepBeforeBrowserRequest = 1100;
    static numberOfSearchTypes = 4;
    static chances = {
        useMainProblemSearchQueriesNewSolutions: 0.2,
        useOtherSubProblemSearchQueriesNewSolutions: 0.1,
        notUsingFirstSearchQueryForNewSolutions: 0.5,
        useMainProblemVectorSearchNewSolutions: 0.1
    };
    static limits = {
        webPageVectorResultsForNewSolutions: 10,
        useTopNFromSearchResultsArray: 3
    };
    static enable = {
        refine: {
            createSubProblems: true,
            createEntities: true,
            createSolutions: true,
            createProsCons: true
        }
    };
    static evolution = {
        populationSize: 50,
        useEliteForSeedPercent: 0.3,
        // Population split
        keepElitePercent: 0.1,
        randomImmigrationPercent: 0.1,
        mutationOffspringPercent: 0.3,
        crossoverPercent: 0.5,
        mutationRate: 0.1,
        mutationPromptChangesRate: 'medium',
        selectParentTournamentSize: 7
    };
    static currentUserAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
}
