"use strict";

var async = require("async");
var log = require('../utils/logger');
var toJson = require('../utils/to_json');
var _ = require('lodash');
var queue = require('../workers/queue');

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

    timestamps: true,

    indexes: [
      {
        name: 'notification_by_type_and_user_id',
        fields: ['type','user_id']
      },
      { name: 'notification_user_id_deleted_viewed',
        fields: ['user_id', 'deleted', 'viewed']
      },
      { name: 'ac_notifications_idx_user_id_type_deleted_created_at',
        fields: ['user_id','type','deleted','created_at']
      },
      {
        fields: ['user_interaction_profile'],
        using: 'gin',
        operator: 'jsonb_path_ops'
      }
    ],

    // Add following index manually for high throughput sites
    // CREATE INDEX notification_activit_idx_ac_id ON notification_activities (ac_notification_id);
    
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

      anonymousNotificationSettings: {
        my_posts: {
          method: 0,
          frequency: 2
        },
        my_posts_endorsements: {
          method: 0,
          frequency: 2
        },
        my_points: {
          method: 0,
          frequency: 2
        },
        my_points_endorsements: {
          method: 0,
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
          method: 0,
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
        //notificationJson['activity'] = activity.toJSON();

        var queuePriority;
        if (user.last_login_at && ((new Date().getDate()-5)<user.last_login_at)) {
          queuePriority = 'high';
        } else {
          queuePriority = 'medium';
        }

        queue.create('process-notification-delivery', notificationJson).priority(queuePriority).removeOnComplete(true).save();

        // Disabled for now
        //queue.create('process-notification-news-feed', notificationJson).priority(queuePriority).removeOnComplete(true).save();

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

      createReportNotifications: function(user, activity, callback) {
        log.info('createReportNotifications');

        var activityWithAdmins;
        var allAdmins;

        async.series([
          function (seriesCallback) {
            sequelize.models.AcActivity.find({
              where: { id: activity.id },
              include: [
                {
                  model: sequelize.models.Community,
                  required: true,
                  include: [
                    {
                      model: sequelize.models.User,
                      attributes: _.concat(sequelize.models.User.defaultAttributesWithSocialMediaPublicAndEmail, ['created_at', 'last_login_at']),
                      as: 'CommunityAdmins',
                      required: false
                    }
                  ]
                },
                {
                  model: sequelize.models.Group,
                  required: true,
                  include: [
                    {
                      model: sequelize.models.User,
                      attributes: _.concat(sequelize.models.User.defaultAttributesWithSocialMediaPublicAndEmail, ['created_at', 'last_login_at']),
                      as: 'GroupAdmins',
                      required: false
                    }
                  ]
                },
                {
                  model: sequelize.models.Post,
                  required: false
                },
                {
                  model: sequelize.models.Point,
                  required: false
                }
              ]
            }).then(function (results) {
              if (results && (results.Community.CommunityAdmins || results.Community.GroupAdmins)) {
                activityWithAdmins = results;
                seriesCallback();
              } else {
                seriesCallback('Activity not found');
              }
            }).catch(function (error) {
              seriesCallback(error);
            });
          },
          function (seriesCallback) {
            allAdmins = _.concat(activityWithAdmins.Community.CommunityAdmins, activityWithAdmins.Group.GroupAdmins);
            allAdmins = _.uniqBy(allAdmins, function (admin) {
              return admin.email;
            });
            async.eachSeries(allAdmins, function (admin, innerSeriesCallback) {
              sequelize.models.AcNotification.build({
                type: 'notification.report.content',
                priority: 100,
                status: 'active',
                ac_activity_id: activity.id,
                from_notification_setting: "reportContent",
                user_id: admin.id
              }).save().then(function(notification) {
                if (notification) {
                  notification.addAcActivities(activity).then(function (results) {
                    if (results) {
                      var notificationJson = { id: notification.id };
                      queue.create('process-notification-delivery', notificationJson).priority('high').removeOnComplete(true).save();
                      log.info('Notification Created', { notification: toJson(notification), userId: admin.id});
                      innerSeriesCallback();
                    } else {
                      innerSeriesCallback("Notification Error Can't add activity");
                    }
                  });
                } else {
                  log.error('Notification Creation Error', { err: "No notification", user: user.id});
                  innerSeriesCallback("Could not create notification");
                }
              }).catch(function (error) {
                log.error('Notification Creation Error', { err: error, user: user.id});
                innerSeriesCallback(error)
              });

            }, function (error) {
              seriesCallback(error);
            });
          }
        ], function (error) {
          callback(error);
        });
      },

      createNotificationFromActivity: function(user, activity, type, notification_setting_type, priority, callback) {
        log.info('AcNotification Notification', {type: type, priority: priority });

        if (user==null) {
          user = { id: null };
        }

        if (typeof user == "number") {
          user = { id: user };
        }

        if (typeof user == "string" && user.length>0) {
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
            callback("Notification Create Error");
          }
        }).catch(function (error) {
         log.error('Notification Creation Error', { err: error, user: user.id});
         callback(error);
       });
      }
    }
  });

  return AcNotification;
};
