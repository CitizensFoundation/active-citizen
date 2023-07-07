import { Queue } from "bullmq";
import ioredis from "ioredis";

const redis = new ioredis.default(
  process.env.REDIS_MEMORY_URL || "redis://localhost:6379"
);

const myQueue = new Queue("agent-innovation");

const output = await redis.get("st_mem:1:id");

const memory = JSON.parse(output!) as IEngineInnovationMemoryData

console.log("output", JSON.stringify(memory, null, 2));

//memory.currentStage = "create-sub-problems";
//memory.currentStage = "rank-sub-problems";
memory.currentStage = "create-entities";

await redis.set("st_mem:1:id", JSON.stringify(memory));

console.log("Adding job to queue");

await myQueue.add("agent-innovation", {
  groupId: 1,
  communityId: 1,
  domainId: 1,
  initialProblemStatement:
    "Climate change, an escalating global crisis, is manifesting through an extensive range of effects that are severely impacting our planet's ecosystems, biodiversity, and human societies. These impacts necessitate immediate and substantial mitigation measures.",
});

console.log("After adding job to queue");

let run = true;

while (run) {
  await new Promise((resolve) => setTimeout(resolve, 30000));
  const output = await redis.get("st_mem:1:id");
  if (output) {
    const memory = JSON.parse(output!);
    console.log("output", JSON.stringify(memory, null, 2));
  }
}

process.exit(0);
