import { BaseAgent } from "../baseAgent.js";
import { Worker, Job } from "bullmq";
import { CreateSubProblemsProcessor } from "./processors/create/createSubProblems.js";
import { CreateEntitiesProcessor } from "./processors/create/createEntities.js";
import { CreateProsConsProcessor } from "./processors/create/createProsCons.js";
import { CreateSearchQueriesProcessor } from "./processors/create/createSearchQueries.js";
import { CreateSolutionsProcessor } from "./processors/create/createSolutions.js";
import { RankEntitiesProcessor } from "./processors/ranking/rankEntities.js";
import { RankProsConsProcessor } from "./processors/ranking/rankProsCons.js";
import { RankSearchQueriesProcessor } from "./processors/ranking/rankSearchQueries.js";
import { RankSearchResultsProcessor } from "./processors/ranking/rankSearchResults.js";
import { RankSolutionsProcessor } from "./processors/ranking/rankSolutions.js";
import { RankSubProblemsProcessor } from "./processors/ranking/rankSubProblems.js";
import { GetWebPagesProcessor } from "./processors/web/getWebPages.js";
import { SearchWebProcessor } from "./processors/web/searchWeb.js";

export class AgentInnovation extends BaseAgent {
  declare memory: IEngineInnovationMemoryData;

  override async initializeMemory(job: Job) {
    const jobData = job.data as IEngineWorkerData;

    this.memory = {
      redisKey: this.getRedisKey(jobData.groupId),
      groupId: jobData.groupId,
      communityId: jobData.communityId,
      domainId: jobData.domainId,
      currentStage: "create-sub-problems",
      stages: {
        "create-sub-problems": {},

        "rank-sub-problems": {},

        "create-entities": {},

        "rank-entities": {},

        "create-search-queries": {},

        "rank-search-queries": {},

        "web-search": {},

        "rank-search-results": {},

        "web-get-pages": {},

        "create-seed-solutions": {},

        "create-pros-cons": {},

        "rank-pros-cons": {},

        "rank-solutions": {},

        "evolve-create-population": {},

        "evolve-mutate-population": {},

        "evolve-recombine-population": {},

        "evolve-rank-population": {},
        "parse": {},
        "save": {},
        "done": {}
      },
      timeStart: Date.now(),
      totalCost: 0,
      problemStatement: {
        description: jobData.initialProblemStatement,
        searchQueries: {
          general: [],
          scientific: [],
          news: [],
          openData: [],
        },
        searchResults: {
          pages: {
            general: [],
            scientific: [],
            news: [],
            openData: []
          },
          knowledgeGraph: {
            general: [],
            scientific: [],
            news: [],
            openData: [],
          }
        },
      },
      subProblems: [],
      currentStageData: undefined
    } as IEngineInnovationMemoryData;
    await this.saveMemory();
  }

  async setStage(stage: IEngineStageTypes) {
    this.memory.currentStage = stage;
    this.memory.stages[stage].timeStart = Date.now();

    await this.saveMemory();
  }

  async processSubProblems() {
    const subProblemsProcessor = new CreateSubProblemsProcessor(
      this.job,
      this.memory
    );

    await subProblemsProcessor.process();
  }

  async process() {
    switch (this.memory.currentStage) {
      case "create-sub-problems":
        await this.processSubProblems();
        break;
      case "create-entities":
        const createEntitiesProcessor = new CreateEntitiesProcessor(
          this.job,
          this.memory
        );
        await createEntitiesProcessor.process();
        break;
      case "create-pros-cons":
        const createProsConsProcessor = new CreateProsConsProcessor(
          this.job,
          this.memory
        );
        await createProsConsProcessor.process();
        break;
      case "create-search-queries":
        const createSearchQueriesProcessor = new CreateSearchQueriesProcessor(
          this.job,
          this.memory
        );
        await createSearchQueriesProcessor.process();
        break;
      case "create-seed-solutions":
        const createSolutionsProcessor = new CreateSolutionsProcessor(
          this.job,
          this.memory
        );
        await createSolutionsProcessor.process();
        break;
      case "rank-entities":
        const rankEntitiesProcessor = new RankEntitiesProcessor(
          this.job,
          this.memory
        );
        await rankEntitiesProcessor.process();
        break;
      case "rank-pros-cons":
        const rankProsConsProcessor = new RankProsConsProcessor(
          this.job,
          this.memory
        );
        await rankProsConsProcessor.process();
        break;
      case "rank-search-queries":
        const rankSearchQueriesProcessor = new RankSearchQueriesProcessor(
          this.job,
          this.memory
        );
        await rankSearchQueriesProcessor.process();
        break;
      case "rank-search-results":
        const rankSearchResultsProcessor = new RankSearchResultsProcessor(
          this.job,
          this.memory
        );
        await rankSearchResultsProcessor.process();
        break;
      case "rank-solutions":
        const rankSolutionsProcessor = new RankSolutionsProcessor(
          this.job,
          this.memory
        );
        await rankSolutionsProcessor.process();
        break;
      case "rank-sub-problems":
        const rankSubProblemsProcessor = new RankSubProblemsProcessor(
          this.job,
          this.memory
        );
        await rankSubProblemsProcessor.process();
        break;
      case "web-get-pages":
        const getWebPagesProcessor = new GetWebPagesProcessor(
          this.job,
          this.memory
        );
        await getWebPagesProcessor.process();
        break;
      case "web-search":
        const searchWebProcessor = new SearchWebProcessor(
          this.job,
          this.memory
        );
        await searchWebProcessor.process();
        break;
      default:
        console.log('No stage matched');
    }
  }
}

const agent = new Worker(
  "agent-innovation",
  async (job: Job) => {
    console.log(`Processing job ${job.id}`);
    const agent = new AgentInnovation();
    await agent.setup(job);
    await agent.process();
    return job.data;
  },
  { concurrency: parseInt(process.env.AGENT_INNOVATION_CONCURRENCY || "1") }
);

process.on("SIGINT", async () => {
  await agent.close();
});