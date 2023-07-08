import { Queue } from "bullmq";
import ioredis from "ioredis";
const redis = new ioredis.default(process.env.REDIS_MEMORY_URL || "redis://localhost:6379");
const deleteALl = false;
const getMemory = true;
const setNewStage = true;
const addJob = true;
const run = false;
const myQueue = new Queue("agent-innovation");
if (deleteALl) {
    await myQueue.drain();
    await myQueue.clean(0, 10000, "active");
    await myQueue.clean(0, 10000, "failed");
    await myQueue.clean(0, 10000, "completed");
    await myQueue.clean(0, 10000, "wait");
    await myQueue.clean(0, 10000, "delayed");
    await myQueue.obliterate();
    //await redis.del("st_mem:1:id");
}
if (getMemory) {
    const output = await redis.get("st_mem:1:id");
    const memory = JSON.parse(output);
    console.log("output", JSON.stringify(memory, null, 2));
    if (setNewStage) {
        //memory.currentStage = "create-sub-problems";
        //memory.currentStage = "rank-sub-problems";
        //memory.currentStage = "create-entities";
        //memory.currentStage = "rank-entities";
        memory.currentStage = "create-search-queries";
        await redis.set("st_mem:1:id", JSON.stringify(memory));
    }
}
if (addJob) {
    console.log("Adding job to queue");
    await myQueue.add("agent-innovation", {
        groupId: 1,
        communityId: 1,
        domainId: 1,
        initialProblemStatement: "Liberal democracies, despite their advantages like political freedom, civil liberties, and legal equality, are grappling with rising challenges. These include fair representation of diverse groups, dwindling democratic engagement, political financial influence, growing media polarization, and diminishing trust in public institutions. These problems risk undermining the effectiveness and reliability of these democracies, fueling citizen dissatisfaction and threatening their political stability.",
    }, { removeOnComplete: true, removeOnFail: true });
    console.log("After adding job to queue");
}
while (run) {
    await new Promise((resolve) => setTimeout(resolve, 60000));
    const output = await redis.get("st_mem:1:id");
    if (output) {
        const memory = JSON.parse(output);
        console.log("output", JSON.stringify(memory, null, 2));
    }
}
process.exit(0);
