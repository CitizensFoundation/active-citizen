import { BaseAgent } from "../baseAgent.js";
import { Worker, Job } from "bullmq";
import { CreateSubProblemsProcessor } from "./processors/create/createSubProblems.js";

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
    }
  }
}

const agent = new Worker(
  "agent-innovation",
  async (job: Job) => {
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