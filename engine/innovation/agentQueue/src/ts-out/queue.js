"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino = require('pino');
require("./workers/web/search.js");
require("./workers/web/getPage.js");
require("./agents/innovation/innovation.js");
exports.logger = pino({
    name: 'innovation-engine',
    level: process.env.QUEUE_LOG_LEVEL || 'debug'
});
process.on("uncaughtException", function (err) {
    exports.logger.error(err, "Uncaught exception");
});
process.on("unhandledRejection", (reason, promise) => {
    exports.logger.error({ promise, reason }, "Unhandled Rejection at: Promise");
});
