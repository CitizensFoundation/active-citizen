"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentInnovation = void 0;
const baseAgent_1 = require("../baseAgent");
const bullmq_1 = require("bullmq");
const createSubProblems_1 = require("./processors/create/createSubProblems");
class AgentInnovation extends baseAgent_1.BaseAgent {
    async initializeMemory(job) {
        const jobData = job.data;
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
        };
        await this.saveMemory();
    }
    async setStage(stage) {
        this.memory.currentStage = stage;
        this.memory.stages[stage].timeStart = Date.now();
        await this.saveMemory();
    }
    async processSubProblems() {
        const subProblemsProcessor = new createSubProblems_1.CreateSubProblemsProcessor(this.job, this.memory);
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
exports.AgentInnovation = AgentInnovation;
const agent = new bullmq_1.Worker("agent-innovation", async (job) => {
    const agent = new AgentInnovation();
    await agent.setup(job);
    await agent.process();
    return job.data;
}, { concurrency: parseInt(process.env.AGENT_INNOVATION_CONCURRENCY || "1") });
process.on("SIGINT", async () => {
    await agent.close();
});
