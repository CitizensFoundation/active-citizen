// https://gist.github.com/mojodna/1251812
var async = require("async");
var models = require("../../models");
var log = require('../utils/logger');
var queue = require('./queue');
var i18n = require('../utils/i18n');
var toJson = require('../utils/to_json');
var airbrake = require('../utils/airbrake');

var GenerateNewsFeedFromNotifications = require('../engine/news_feeds/generate_from_notifications.js');
var NotificationNewsFeedWorker = function () {};

NotificationNewsFeedWorker.prototype.process = function (notificationJson, callback) {
  var user;
  var notification;
  var domain;
  var community;

  async.series([
    function(seriesCallback){
      models.AcNotification.find({
        where: { id: notificationJson.id },
        order: [
          [ { model: models.AcActivity, as: 'AcActivities' } ,'updated_at', 'asc' ]
        ],
        include: [
          {
            model: models.User,
            attributes: ['id','notifications_settings','email','name','created_at'],
            required: false
          },
          {
            model: models.AcActivity,
            as: 'AcActivities',
            required: true,
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
                required: false
              }
            ]
          }
        ]
      }).then(function(results) {
        if (results) {
          notification = results;
          domain = notification.AcActivities[0].Domain;
          community = notification.AcActivities[0].Community;
          seriesCallback();
        } else {
          seriesCallback('Notification not found');
        }
      }).catch(function(error) {
        seriesCallback(error);
      });
    },
    function(seriesCallback){
      models.User.find({
        where: { id: notification.user_id },
        attributes: ['id','notifications_settings','email','name','created_at']
      }).then(function(userResults) {
        if (userResults) {
          user = userResults;
          seriesCallback();
        } else {
          seriesCallback();
        }
      }).catch(function(error) {
        seriesCallback(error);
      });
    },
    function(seriesCallback){
      if (user) {
        user.setLocale(i18n, domain, community, function () {
          seriesCallback();
        });
      } else {
        seriesCallback();
      }
    }
  ],
  function(error) {
    if (error) {
      log.error("NotificationNewsFeedWorker Error", {err: error});
      airbrake.notify(error, function(airbrakeErr, url) {
        if (airbrakeErr) {
          log.error("AirBrake Error", { context: 'airbrake', user: toJson(req.user), err: airbrakeErr });
        }
        callback(error);
      });
    } else {
      log.info('Processing NotificationNewsFeedWorker Started', { type: notification.type, user: user ? user.simple() : null });
      switch(notification.type) {
        case "notification.post.new":
        case "notification.post.endorsement":
        case "notification.point.new":
        case "notification.point.quality":
          GenerateNewsFeedFromNotifications(notification, user, function () {
            log.info('Processing GenerateNewsFeedFromNotifications Completed', { type: notification.type, user: user.simple() });
            callback();
          });
          break;
        default:
          callback();
      }
    }
  });
};

module.exports = new NotificationNewsFeedWorker();
