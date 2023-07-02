import { Job } from "bullmq";
import { Base } from "../../../base";

const Redis = require("ioredis");
const redis = new Redis(process.env.REDIS_MEMORY_URL || undefined);

export abstract class BaseProcessor extends Base {
  memory!: IEngineMemoryData;
  job!: Job;

  constructor(job: Job, memory: IEngineMemoryData) {
    super();
    this.job = job;
    this.memory = memory;
  }

  async process() {
    if (!this.memory) {
      this.logger.error("Memory is not initialized");
      throw new Error("Memory is not initialized");
    }
  }

  async saveMemory() {
    await redis.set(this.memory.id, JSON.stringify(this.memory));
  }
}
