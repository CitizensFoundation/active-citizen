const gpt4InTokenPrice = 0.03/1000;
const gpt4OutTokenPrice = 0.06/1000;

export class IEngineConstants {
  static createSubProblemsModel =  {
    name: "gpt-4",
    temperature: 0.9,
    maxTokens: 450,
    inTokenCostUSD: gpt4InTokenPrice,
    outTokenCostUSD: gpt4OutTokenPrice,
    verbose: true
  };

  static createEntitiesModel =  {
    name: "gpt-4",
    temperature: 0.7,
    maxTokens: 2048,
    inTokenCostUSD: gpt4InTokenPrice,
    outTokenCostUSD: gpt4OutTokenPrice,
    verbose: true
  };

  static createSearchQueriesModel =  {
    name: "gpt-4",
    temperature: 0.7,
    maxTokens: 1024,
    inTokenCostUSD: gpt4InTokenPrice,
    outTokenCostUSD: gpt4OutTokenPrice,
    verbose: true
  };
}
