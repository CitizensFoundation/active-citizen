import { BaseAgent } from "../baseAgent";
import { Worker, Job } from "bullmq";
import { CreateSubProblemsProcessor } from "./processors/createSubProblems";

export class AgentInnovation extends BaseAgent {
  declare memory: IEngineInnovationMemoryData;

  override async initializeMemory(job: Job) {
    this.memory = {
      id: this.getMemoryIdKey(job.data.memoryId),
      currentStage: "create-sub-problems",
      stages: {
        "create-sub-problems": {},
        "create-entities": {},
        "web-search": {},
        "web-get-pages": {},
        "parse": {},
        "save": {},
        "done": {}
      },
      initialTimeStart: Date.now(),
      totalCost: 0,
      problemStatement: job.data.initialProblemStatement,
      entities: [],
      solutionIdeas: [],
    };

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
