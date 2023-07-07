import { Queue } from "bullmq";
import ioredis from "ioredis";

const redis = new ioredis.default(
  process.env.REDIS_MEMORY_URL || "redis://localhost:6379"
);

const myQueue = new Queue("agent-innovation");
await myQueue.drain();
await myQueue.clean(0,10000,"active");
await myQueue.clean(0,10000,"failed");
await myQueue.clean(0,10000,"completed");
await myQueue.clean(0,10000,"wait");
await myQueue.clean(0,10000,"delayed");
await myQueue.obliterate();
await redis.del("st_mem:1:id");

//const output = await redis.get("st_mem:1:id");

//const memory = JSON.parse(output!) as IEngineInnovationMemoryData

//console.log("output", JSON.stringify(memory, null, 2));

//memory.currentStage = "create-sub-problems";
//memory.currentStage = "rank-sub-problems";
//memory.currentStage = "create-entities";
//memory.currentStage = "rank-entities";
//memory.currentStage = "create-search-queries";

//await redis.set("st_mem:1:id", JSON.stringify(memory));

//console.log("Adding job to queue");

//await myQueue.clean(0,0,"active");

/*await myQueue.add("agent-innovation", {
  groupId: 1,
  communityId: 1,
  domainId: 1,
  initialProblemStatement:
    "While liberal democracies offer numerous benefits such as political freedom, civil liberties, and equality before the law, they are increasingly facing challenges related to the equitable representation of diverse populations, the influence of money in politics, the rise of polarized media, and an erosion of trust in public institutions. These issues potentially undermine the efficacy and credibility of liberal democracies, leading to growing dissatisfaction among citizens and threatening the stability of these political systems. The critical problem, therefore, is identifying strategies to address these emerging challenges and bolster the robustness and legitimacy of liberal democracies in the 21st century.",
}, { removeOnComplete: true, removeOnFail: true });

console.log("After adding job to queue");

let run = true;

while (run) {
  await new Promise((resolve) => setTimeout(resolve, 60000));
  const output = await redis.get("st_mem:1:id");
  if (output) {
    const memory = JSON.parse(output!);
    console.log("output", JSON.stringify(memory, null, 2));
  }
}
*/
process.exit(0);
