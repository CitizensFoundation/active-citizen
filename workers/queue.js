const log = require('../utils/logger');
const url = require('url');

var airbrake = null;
if(process.env.AIRBRAKE_PROJECT_ID) {
  airbrake = require('../utils/airbrake');
}

const BullQueue = require('bull');

const redisUrl = process.env.REDIS_URL ? process.env.REDIS_URL : "redis://localhost:6379";

const redis_uri = url.parse(redisUrl);

const redisOptions = redisUrl.includes("rediss://")
  ? { redis: {
    port: Number(redis_uri.port),
    host: redis_uri.hostname,
    password: redis_uri.auth.split(":")[1],
    db: 0,
    tls: {
      rejectUnauthorized: false,
    },
  }}
  : redisUrl;

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
    this.mainQueue = new BullQueue('mainYpQueue', redisOptions, this.defaultQueueOptions);
    this.mainQueue.on('active', function(job) {
      log.info('JQ', { id: job.id, name: job.name });
    }).on('completed', function(job, result){
      log.info('JC', { id: job.id, name: job.name });
    }).on('failed', function(job, error){
      log.error('Job Failed', { id: job.id, name: job.name, data: job.data, error });
    }).on('resumed', function(job){
      log.info('Job Removed', { id: job.id });
    }).on('waiting', function(jobId){
      log.info('Job Waiting', { id: jobId });
    }).on('stalled', function(job){
      log.info('Job Stalled', { id: job.id, name: job.name, data: job.data, });
    }).on('progress', function(job, process){
      log.info('Job Progress', { id: job.id, process });
    }).on('paused', function(){
      log.info('Queue Paused');
    }).on('cleaned', function(jobs, type){
      log.info('Job Cleaned', { jobs, type });
    }).on('drained', function(){
      log.info('Queue Drained');
    }).on( 'error', function( error ) {
      log.error('Job Error', { error } );
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