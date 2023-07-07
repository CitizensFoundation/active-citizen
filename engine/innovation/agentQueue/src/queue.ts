import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.WORKER_LOG_LEVEL || 'debug'
});

process.on("uncaughtException", function (err) {
  logger.error(err);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at: Promise");
});

export { logger };
