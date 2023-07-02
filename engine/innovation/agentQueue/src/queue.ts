const pino = require('pino');

import './workers/web/search.js';
import './workers/web/getPage.js';
import './agents/innovation/innovation.js'

export const logger = pino({
  name: 'innovation-engine',
  level: process.env.QUEUE_LOG_LEVEL || 'debug'
});

process.on("uncaughtException", function (err) {
  logger.error(err, "Uncaught exception");
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ promise, reason }, "Unhandled Rejection at: Promise");
});
