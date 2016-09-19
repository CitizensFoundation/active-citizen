// https://gist.github.com/mojodna/1251812

var models = require("../../models");
var log = require('../utils/logger');
var toJson = require('../utils/to_json');
var async = require('async');
var airbrake = require('../utils/airbrake');

var generatePostNotification = require('../engine/notifications/generate_post_notifications.js');
var generatePointNotification = require('../engine/notifications/generate_point_notifications.js');
var generateRecommendationEvent = require('../engine/recommendations/events_manager').generateRecommendationEvent;
var generatePostStatusChangeNotification = require('../engine/notifications/generate_post_status_change_notifications.js');

var ActivityWorker = function () {};

ActivityWorker.prototype.process = function (activityJson, callback) {
  var activity;
  log.info('Processing activity Started');
  async.series([
    function (seriesCallback) {
      models.AcActivity.find({
        where: { id: activityJson.id },
        include: [
          {
            model: models.User,
            attributes: ['id','notifications_settings','email','name','created_at'],
            required: false
          },
          {
            model: models.Domain,
            required: false
          },
          {
            model: models.Community,
            required: false
          },
          {
            model: models.Group,
            required: false
          },
          {
            model: models.Post,
            required: false
          },
          {
            model: models.Point,
            required: false,
            include: [
              {
                model: models.Post,
                required: false
              }
            ]
          }
        ]
      }).then(function (results) {
        if (results) {
          activity = results;
          seriesCallback();
        } else {
          seriesCallback('Activity not found');
        }
      }).catch(function (error) {
        seriesCallback(error);
      });
    },
    function (seriesCallback) {
      log.info('Processing Activity Started', {type: activity.type});
      try {
        switch (activity.type) {
          case "activity.user.invite":
            models.AcNotification.createNotificationFromActivity(activity.actor.user_id, activity, "notification.user.invite", "priority", 70, function (error) {
              log.info('Processing activity.user.invite Completed', {type: activity.type, err: error});
              seriesCallback(error);
            });
            break;
          case "activity.password.recovery":
            models.AcNotification.createNotificationFromActivity(activity.actor.user, activity, "notification.password.recovery", "priority", 100, function (error) {
              log.info('Processing activity.password.recovery Completed', {type: activity.type, err: error});
              seriesCallback(error);
            });
            break;
          case "activity.password.changed":
            models.AcNotification.createNotificationFromActivity(activity.actor.user, activity, "notification.password.changed", "priority", 100, function (error) {
              log.info('Processing activity.password.changed Completed', {type: activity.type, err: error});
              seriesCallback(error);
            });
            break;
          case "activity.post.new":
          case "activity.post.opposition.new":
          case "activity.post.endorsement.new":
            generatePostNotification(activity, activity.User, function (error) {
              if (error) {
                log.error('Processing activity.post.* Error', {type: activity.type, err: error});
                seriesCallback(error);
              } else {
                log.info('Processing activity.post.* Completed', {type: activity.type});
                seriesCallback();
              }
            });
            break;
          case "activity.point.new":
          case "activity.point.helpful.new":
          case "activity.point.unhelpful.new":
            generatePointNotification(activity, activity.User, function (error) {
              if (error) {
                log.error('Processing activity.point.* Completed', {type: activity.type, err: error});
                seriesCallback(error);
              } else {
                log.info('Processing activity.point.* Completed', {type: activity.type});
                seriesCallback();
              }
            });
            break;
          case "activity.post.status.change":
            generatePostStatusChangeNotification(activity, activity.User, function (error) {
              if (error) {
                log.error('Processing activity.post.status.change Completed', {type: activity.type, err: error});
                seriesCallback(error);
              } else {
                log.info('Processing activity.post.status.change Completed', {type: activity.type});
                seriesCallback();
              }
            });
            break;
          default:
            seriesCallback();
        }
      } catch (error) {
        log.error("Processing Activity Error", {err: error});
        seriesCallback(error);
      }
    },
    function (seriesCallback) {
      generateRecommendationEvent(activity, seriesCallback);
    }
  ], function (error) {
    if (error) {
      log.error("Processing Activity Error", {err: error});
      airbrake.notify(error, function(airbrakeErr, url) {
        if (airbrakeErr) {
          log.error("AirBrake Error", { context: 'airbrake', err: airbrakeErr, errorStatus: 500 });
        }
        callback(error);
      });
    } else {
      log.info('Processing Activity and Recommendation Completed', {type: activity.type});
      callback();
    }
  });
};

module.exports = new ActivityWorker();
