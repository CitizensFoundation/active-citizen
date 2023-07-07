import { BaseWorker } from "../workers/baseWorker.js";
const Redis = require("ioredis");
const redis = new Redis(process.env.REDIS_MEMORY_URL || undefined);
export class BaseAgent extends BaseWorker {
    memory;
    job;
    getRedisKey(groupId) {
        return `st_mem:${groupId}:id`;
    }
    async setup(job) {
        this.job = job;
        const jobData = job.data;
        try {
            const memoryData = (await redis.get(this.getRedisKey(jobData.groupId)));
            if (memoryData) {
                this.memory = JSON.parse(memoryData);
            }
            else {
                await this.initializeMemory(job);
                this.logger.debug(`Initialized memory for ${JSON.stringify(jobData)}`);
            }
        }
        catch (error) {
            this.logger.error(error);
        }
    }
    async saveMemory() {
        this.memory.lastSavedAt = Date.now();
        await redis.set(this.memory.redisKey, JSON.stringify(this.memory));
    }
}
