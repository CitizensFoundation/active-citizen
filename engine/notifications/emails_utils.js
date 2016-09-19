var models = require("../../../models");
var log = require('../../utils/logger');
var toJson = require('../../utils/to_json');
var async = require('async');
var queue = require('../../workers/queue');

var filterNotificationForDelivery = function (notification, user, template, subject, callback) {
  var method = user.notifications_settings[notification.from_notification_setting].method;
  var frequency = user.notifications_settings[notification.from_notification_setting].frequency;

  //TODO: Switch from FREQUENCY_AS_IT_HAPPENS if user has had a lot of emails > 25 in the hour or something

  console.log("Notification Email Processing", {email: user.email, notification_settings_type: notification.notification_setting_type,
                                                method: method, frequency: frequency});

  if (method !== models.AcNotification.METHOD_MUTED) {
    if (frequency === models.AcNotification.FREQUENCY_AS_IT_HAPPENS) {
      console.log("Notification Email Processing Sending eMail", {email: user.email, method: method, frequency: frequency});
      queue.create('send-one-email', {
        subject: subject,
        template: template,
        user: user,
        domain: notification.AcActivities[0].Domain,
        community: notification.AcActivities[0].Community,
        activity: notification.AcActivities[0],
        post: notification.AcActivities[0].Post,
        point: notification.AcActivities[0].Point
      }).priority('critical').removeOnComplete(true).save();
      callback();
    } else if (method !== models.AcNotification.METHOD_MUTED) {
      models.AcDelayedNotification.findOrCreate({
        where: {
          user_id: user.id,
          method: method,
          frequency: frequency,
          type: notification.type
        },
        defaults: {
          user_id: user.id,
          method: method,
          frequency: frequency,
          type: notification.type
        }
      }).spread(function(delayedNotification, created) {
        if (created) {
          log.info('Notification Email Processing AcDelayedNotification Created', { delayedNotification: toJson(delayedNotification), context: 'create' });
        } else {
          log.info('Notification Email Processing AcDelayedNotification Loaded', { delayedNotification: toJson(delayedNotification), context: 'loaded' });
        }
        delayedNotification.addAcNotifications(notification).then(function (results) {
          if (delayedNotification.delivered) {
            log.info('Notification Email Processing AcDelayedNotification already delivered resetting');
            delayedNotification.delivered = false;
            delayedNotification.save().then(function (results) {
              callback();
            });
          } else {
            callback();
          }
        });
      }).catch(function (error) {
        callback(error);
      });
    }
  } else {
    callback();
  }
};

module.exports = {
  filterNotificationForDelivery: filterNotificationForDelivery
};