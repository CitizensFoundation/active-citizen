import { Job } from "bullmq";
import { BaseWorker } from "../workers/baseWorker.js";
const Redis = require("ioredis");
const redis = new Redis(process.env.REDIS_MEMORY_URL || undefined);

export abstract class BaseAgent extends BaseWorker {
  memory!: IEngineMemoryData;
  job!: Job;

  getRedisKey(groupId: number) {
    return `st_mem:${groupId}:id`;
  }

  abstract initializeMemory(job: Job): Promise<void>;
  abstract process(): Promise<void>;

  async setup(job: Job) {
    this.job = job;
    const jobData = job.data as IEngineWorkerData;
    try {
      const memoryData =
        (await redis.get(this.getRedisKey(jobData.groupId)));
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
    this.memory.lastSavedAt = Date.now();
    await redis.set(this.memory.redisKey, JSON.stringify(this.memory));
  }
}
