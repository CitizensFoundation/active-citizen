const log = require('../utils/logger');

var airbrake = null;
if(process.env.AIRBRAKE_PROJECT_ID) {
  airbrake = require('../utils/airbrake');
}

const BullQueue = require('bull');

const redisUrl = process.env.REDIS_URL ? process.env.REDIS_URL : "redis://localhost:6379";
log.info("Starting app access to Bull Queue", {redis_url: redisUrl});

class YpQueue {
  constructor() {
    console.log("Create YpQueue")
    this.createQueues();
  }

  get defaultQueueOptions() {
    return {
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true
      }
    }
  }

  process(name, concurrency, processor) {
    this.mainQueue.process(name, concurrency, processor);
  }

  add(name, workPackage, priority, options) {
    const jobOptions = options || {};

    let priorityNumber = 1000;

    switch (priority) {
      case 'now':
        priorityNumber = 1;
        break;
      case 'critical':
        priorityNumber = 5;
        break;
      case 'high':
        priorityNumber = 100;
        break;
      case 'medium':
        priorityNumber = 1000;
        break;
      case 'low':
        priorityNumber = 10000;
        break;
    }

    jobOptions.priority = priorityNumber;

    this.mainQueue.add(name, workPackage, jobOptions)
  }

  createQueues() {
    this.mainQueue = new BullQueue('mainYpQueue', redisUrl, this.defaultQueueOptions);
    this.mainQueue.on('active', function(id, type) {
      log.info('JQ', { id: id, t: type });
    }).on('completed', function(id, result){
      log.info('JC', { id: id });
    }).on('failed', function(id, result){
      log.error('Job Failed', { id: id, result: result});
    }).on('resumed', function(id, result){
      log.info('Job Removed', { id: id, result: result});
    }).on('waiting', function(id, result){
      log.info('Job Waiting', { id: id, result: result});
    }).on('stalled', function(id, result){
      log.info('Job Stalled', { id: id, result: result});
    }).on('progress', function(id, result){
      log.info('Job Progress', { id: id, result: result});
    }).on('paused', function(id, result){
      log.info('Job Paused', { id: id, result: result});
    }).on('cleaned', function(id, result){
      log.info('Job Cleaned', { id: id, result: result});
    }).on('drained', function(id, result){
      log.info('Job Drained', { id: id, result: result});
    }).on( 'error', function( err, result ) {
      log.error('Job Error', { err: err, result: result } );
      if(airbrake) {
        if (!(err instanceof Error)) {
          err = new Error(result ? result : err);
        }
        airbrake.notify(err).then((airbrakeErr)=> {
          if (airbrakeErr.error) {
            log.error("AirBrake Error", { context: 'airbrake', err: airbrakeErr.error, errorStatus: 500 });
          }
        });
      }
    });
  }
}

module.exports = new YpQueue();