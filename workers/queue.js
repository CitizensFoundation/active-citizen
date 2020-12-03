var kue = require('kue')
  , url = require('url')
var log = require('../utils/logger');
var email = require('./email');
var activity = require('./activity');
var toJson = require('../utils/to_json');

var airbrake = null;
if(process.env.AIRBRAKE_PROJECT_ID) {
  airbrake = require('../utils/airbrake');
}

// make sure we use the Heroku Redis To Go URL
// (put REDISTOGO_URL=redis://localhost:6379 in .env for local testing)

var redisUrl = process.env.REDIS_URL ? process.env.REDIS_URL : "redis://localhost:6379";
log.info("Starting app access to Kue Queue", {redis_url: redisUrl});

var queue = kue.createQueue({
  redis: redisUrl,
  "socket_keepalive" : true
});

queue.watchStuckJobs(2000);

queue.on('job enqueue', function(id, type){
  log.info('Job Enqueue', { id: id, type: type });
}).on('job complete', function(id, result){
  log.info('Job Completed', { id: id });
}).on('job failed', function(id, result){
  log.error('Job Failed', { id: id, result: result});
}).on('job removed', function(id, result){
  log.info('Job Removed', { id: id, result: result});
}).on( 'job error', function( err, result ) {
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

if (process.env.NODE_ENV === 'development' || process.env.FORCE_KUE_UI) {
  kue.app.listen(3000).on('error', function (error) {
    log.warn("Kue UI already started at port 3000", {err: error});
  });
}

module.exports = queue;