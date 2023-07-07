import { Queue } from "bullmq";
import ioredis from "ioredis";
console.log("Starting testInnovation");
const redis = new ioredis.default(
  process.env.REDIS_MEMORY_URL || "redis://localhost:6379"
);
console.log("Connected to redis");
const myQueue = new Queue("agent-innovation");
console.log("Connected to queue");
//await myQueue.drain();
//await myQueue.clean(0, 10000, "active");
//await myQueue.clean(0, 10000, "failed");
//await myQueue.clean(0, 10000, "completed");
//await myQueue.clean(0, 10000, "wait");
//await myQueue.clean(0, 10000, "delayed");
//await myQueue.obliterate();
//await redis.del("st_mem:1:id");
//const output = await redis.get("st_mem:1:id");
//const memory = JSON.parse(output);
//console.log("output", JSON.stringify(memory, null, 2));

//memory.currentStage = "create-sub-problems";
//memory.currentStage = "rank-sub-problems";
//memory.currentStage = "create-entities";
//memory.currentStage = "rank-entities";
//memory.currentStage = "create-search-queries";

//await redis.set("st_mem:1:id", JSON.stringify(memory));

console.log("Adding job to queue");
//await myQueue.clean(0,0,"active");
await myQueue.add(
  "agent-innovation",
  {
    groupId: 1,
    communityId: 1,
    domainId: 1,
    initialProblemStatement:
      `Democracy is in trouble, with growing dissatisfaction among citizens and threatening the stability of the political systems.`,
  },
  { removeOnComplete: true, removeOnFail: true }
);

console.log("After adding job to queue");

/*let run = true;

while (run) {
  await new Promise((resolve) => setTimeout(resolve, 60000));
  const output = await redis.get("st_mem:1:id");
  if (output) {
    const memory = JSON.parse(output);
    console.log("output", JSON.stringify(memory, null, 2));
  }
}
*/
process.exit(0);
