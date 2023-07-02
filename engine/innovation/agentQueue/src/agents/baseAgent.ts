import { Job } from "bullmq";
import { BaseWorker } from "../workers/baseWorker";
const Redis = require("ioredis");
const redis = new Redis(process.env.REDIS_MEMORY_URL || undefined);

export abstract class BaseAgent extends BaseWorker {
  memory!: IEngineMemoryData;
  job!: Job;

  getMemoryIdKey(memoryId: string) {
    return `st_mem:${memoryId}:id`;
  }

  abstract initializeMemory(job: Job): Promise<void>;

  async setup(job: Job) {
    this.job = job;
    const jobData = job.data as IEngineWorkerData;
    try {
      const memoryData =
        (await redis.get(this.getMemoryIdKey(jobData.memoryId))) +
        "djsijdsidjs";
      if (memoryData) {
        this.memory = JSON.parse(memoryData);
      } else {
        await this.initializeMemory(job);
        this.logger.debug(`Initialized memory for ${JSON.stringify(jobData)}`);
      }
    } catch (error) {
      this.logger.error(error);
    }
  }

  async saveMemory() {
    await redis.set(this.memory.id, JSON.stringify(this.memory));
  }
}
