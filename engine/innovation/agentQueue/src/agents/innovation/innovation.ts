import { BaseAgent } from "../baseAgent";
import { Worker, Job } from "bullmq";
import { InitializationProcessor } from "./processors/initalization";

export class AgentInnovation extends BaseAgent {

  override async initializeMemory(job: Job) {
    this.memory = {
      id: this.getMemoryIdKey(job.data.memoryId),
      currentStage: "init",
      currentStageTimeStart: Date.now(),
      currentStageCost: 0,
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
    this.memory.currentStageTimeStart = Date.now();
    this.memory.currentStageCost = 0;
    await this.saveMemory();
  }

  async processInit() {
    const initializationProcessor = new InitializationProcessor(
      this.job,
      this.memory
    );

    await initializationProcessor.process();
  }

  async process(job: Job) {
    if (this.memory.nextStageAfterUserInput) {
      this.memory.currentStage = this.memory.nextStageAfterUserInput;
      this.memory.nextStageAfterUserInput = undefined;
    }

    switch (this.memory.currentStage) {
      case "init":
        await this.processInit();
        break;
      case "search":
        this.logger.info("search");
        this.stage = "get-page";
        break;
      case "get-page":
        this.logger.info("get-page");
        this.stage = "parse";
        break;
      case "parse":
        this.logger.info("parse");
        this.stage = "save";
        break;
      case "save":
        this.logger.info("save");
        this.stage = "done";
        break;
    }
  }
}

const agent = new Worker(
  "agent-innovation",
  async (job: Job) => {
    const agent = new AgentInnovation();
    await agent.setup(job);
    await agent.process(job);
    return job.data;
  },
  { concurrency: parseInt(process.env.AGENT_INNOVATION_CONCURRENCY || "1") }
);

process.on("SIGINT", async () => {
  await agent.close();
});
