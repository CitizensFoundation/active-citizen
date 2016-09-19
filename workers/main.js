var i18n = require('../utils/i18n');
var Backend = require('i18next-node-fs-backend');
var log = require('../utils/logger');
var path = require('path');

log.info("Dirname", {dirname: __dirname});

var localesPath = path.resolve(__dirname, '../locales');

i18n
  .use(Backend)
  .init({
    preload: ['en','is','hr','pl'],

    fallbackLng:'en',

    // this is the defaults
    backend: {
      // path where resources get loaded from
      loadPath: localesPath+'/{{lng}}/translation.json',

      // path to post missing resources
      addPath: localesPath+'/{{lng}}/translation.missing.json',

      // jsonIndent to use when storing json files
      jsonIndent: 2
    }
  }, function (err, t) {
    log.info("Have Loaded i18n", {err: err});
    var email = require('./email');
    var activity = require('./activity');
    var notification_delivery = require('./notification_delivery');
    var notification_news_feed = require('./notification_news_feed');
    var queue = require('./queue');

    queue.process('send-one-email', 1, function(job, done) {
      email.sendOne(job.data, done);
    });

    queue.process('process-activity', 5, function(job, done) {
      activity.process(job.data, done);
    });

    queue.process('process-notification-delivery', 5, function(job, done) {
      notification_delivery.process(job.data, done);
    });

    queue.process('process-notification-news-feed', 5, function(job, done) {
      notification_news_feed.process(job.data, done);
    });
  });

