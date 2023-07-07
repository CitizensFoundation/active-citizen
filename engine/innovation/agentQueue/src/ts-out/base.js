"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Base = void 0;
const pino = require('pino');
class Base {
    logger;
    timeStart = Date.now();
    constructor() {
        this.logger = pino({
            name: 'innovation-worker',
            level: process.env.WORKER_LOG_LEVEL || 'debug'
        });
    }
}
exports.Base = Base;
