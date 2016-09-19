"use strict";

var async = require("async");
var queue = require('../workers/queue');
var log = require('../utils/logger');
var toJson = require('../utils/to_json');

module.exports = function(sequelize, DataTypes) {
  var AcNotification = sequelize.define("AcNotification", {
    priority: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
    sent_email: { type: DataTypes.INTEGER, default: false },
    sent_push: { type: DataTypes.INTEGER, default: false },
    processed_at: DataTypes.DATE,
    user_interaction_profile: DataTypes.JSONB,
    from_notification_setting: DataTypes.STRING,
    viewed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  }, {

    defaultScope: {
      where: {
        deleted: false
      }
    },

    indexes: [
      {
        name: 'notification_public_and_active_by_type',
        fields: ['type'],
        where: {
          status: 'active'
        }
      },
      {
        name: 'notification_active_by_type',
        fields: ['type'],
        where: {
          status: 'active'
        }
      },
      {
        name: 'notification_active_by_type_and_user_id',
        fields: ['type','user_id'],
        where: {
          status: 'active'
        }
      },
      {
        name: 'notification_by_type_and_user_id',
        fields: ['type','user_id']
      },
      {
        name: 'notification_active_by_user_id',
        fields: ['user_id'],
        where: {
          status: 'active'
        }
      },
      {
        name: 'notification_all_by_type',
        fields: ['type']
      },
      {
        fields: ['user_interaction_profile'],
        using: 'gin',
        operator: 'jsonb_path_ops'
      }
    ],
    underscored: true,

    tableName: 'ac_notifications',

    classMethods: {

      METHOD_MUTED: 0,
      METHOD_BROWSER: 1,
      METHOD_EMAIL: 2,
      METHOD_PUSH: 3,
      METHOD_SMS: 4,

      FREQUENCY_AS_IT_HAPPENS: 0,
      FREQUENCY_HOURLY: 1,
      FREQUENCY_DAILY: 2,
      FREQUENCY_WEEKLY: 3,
      FREQUENCY_BI_WEEKLY: 4,
      FREQUENCY_MONTHLY: 5,

      defaultNotificationSettings: {
        my_posts: {
          method: 2,
          frequency: 0
        },
        my_posts_endorsements: {
          method: 2,
          frequency: 2
        },
        my_points: {
          method: 2,
          frequency: 1
        },
        my_points_endorsements: {
          method: 2,
          frequency: 2
        },
        all_community: {
          method: 0,
          frequency: 3
        },
        all_group: {
          method: 0,
          frequency: 3
        },
        newsletter: {
          method: 2,
          frequency: 4
        }
      },

      ENDORSEMENT_GROUPING_TTL: 6 * 60 * 60 * 1000, // milliseconds

      associate: function(models) {
        AcNotification.belongsToMany(models.AcActivity, { as: 'AcActivities', through: 'notification_activities' });
        AcNotification.belongsToMany(models.AcDelayedNotification, { as: 'AcDelayedNotifications', through: 'delayed_notifications' });
        AcNotification.belongsTo(models.User);
      },

      processNotification: function (notification, user, activity, callback) {
        var notificationJson = notification.toJSON();
        notificationJson['activity'] = activity.toJSON();

        var queuePriority;
        if (user.last_login_at && ((new Date().getDate()-5)<user.last_login_at)) {
          queuePriority = 'high';
        } else {
          queuePriority = 'medium';
        }

        queue.create('process-notification-delivery', notificationJson).priority(queuePriority).removeOnComplete(true).save();
        queue.create('process-notification-news-feed', notificationJson).priority(queuePriority).removeOnComplete(true).save();

        // Its being updated and is not new
        if (callback) {
          notification.viewed = false;
          notification.changed('updated_at', true);
          notification.save().then(function (notificationIn) {
            callback();
          }).catch(function (error) {
            callback(error);
          });
        }
      },

      createNotificationFromActivity: function(user, activity, type, notification_setting_type, priority, callback) {
        log.info('AcNotification Notification', {type: type, priority: priority });

        if (user==null) {
          user = { id: null };
        }

        if (typeof user == "number") {
          user = { id: user };
        }
        var domain = activity.object.domain;
        var community = activity.object.community;

        //TODO: Check AcMute and mute if needed

       sequelize.models.AcNotification.build({
         type: type,
         priority: priority,
         status: 'active',
         ac_activity_id: activity.id,
         from_notification_setting: notification_setting_type,
         user_id: user.id
       }).save().then(function(notification) {
          if (notification) {
            notification.addAcActivities(activity).then(function (results) {
              if (results) {
                sequelize.models.AcNotification.processNotification(notification, user, activity);
                log.info('Notification Created', { notification: toJson(notification), userId: user.id});
                callback();
              } else {
                callback("Notification Error Can't add activity");
              }
            });
          } else {
            log.error('Notification Creation Error', { err: "No notification", user: user.id});
            callback();
          }
        }).catch(function (error) {
         log.error('Notification Creation Error', { err: error, user: user.id});
       });
      }
    }
  });

  return AcNotification;
};
