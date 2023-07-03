const pino = require('pino');

export class Base {
  logger: typeof pino;
  timeStart: number =  Date.now();

  constructor() {
    this.logger = pino({
      name: 'innovation-worker',
      level: process.env.WORKER_LOG_LEVEL || 'debug'
    });
  }
}