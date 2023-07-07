"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const baseWorker_1 = require("../baseWorker");
class WorkerWebGetPage extends baseWorker_1.BaseWorker {
    async process(job) { }
}
const worker = new bullmq_1.Worker("worker-web-get-page", async (job) => {
    const getPage = new WorkerWebGetPage();
    await getPage.process(job);
    return job.data;
}, { concurrency: parseInt(process.env.WORKER_WEB_GET_PAGE_CONCURRENCY || "1") });
process.on("SIGINT", async () => {
    await worker.close();
});
