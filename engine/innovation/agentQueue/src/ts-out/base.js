import winston from 'winston';
const logger = winston.createLogger({
    level: process.env.WORKER_LOG_LEVEL || 'debug'
});
export class Base {
    logger;
    timeStart = Date.now();
    constructor() {
        this.logger = logger;
    }
}
