const models = require("../../../models");
const log = require('../../utils/logger');
const toJson = require('../../utils/to_json');
const async = require('async');
const getModelAndUsersByType = require('./notifications_utils').getModelAndUsersByType;
const addNotificationsForUsers = require('./notifications_utils').addNotificationsForUsers;
const addOrPossiblyGroupNotification = require('./notifications_utils').addOrPossiblyGroupNotification;
const _ = require('lodash');

const generateNotificationsForNewPoint = (activity, callback) => {
  // Make sure not to create duplicate notifications to the same user
  const uniqueUserIds = { users: [] };

  let notificationType;

  if (activity.type==='activity.point.newsStory.new') {
    notificationType = 'notification.point.newsStory';
  } else if (activity.type==='activity.point.comment.new') {
      notificationType = 'notification.point.comment';
  } else {
    notificationType = 'notification.point.new';
  }

  async.series([
    (seriesCallback) => {
      // Notifications for my posts
      const userWhere = {};

      userWhere["notifications_settings.my_posts.method"] = {
        $gt: 0
      };

      if (activity.post_id) {
        models.Post.find({
          where: {
            id: activity.post_id
          },
          include: [
            {
              model: models.User,
              attributes: ['id','notifications_settings','email'],
              where: userWhere,
              required: true
            }
          ]
        }).then((post) => {
          if (post) {
            addNotificationsForUsers(activity, [post.User], notificationType, 'my_posts', uniqueUserIds, seriesCallback);
          } else {
            seriesCallback();
          }
        }).catch((error) => {
          seriesCallback(error);
        });
      } else {
        // No post associated with this point
        seriesCallback();
      }
    },

    (seriesCallback) => {
      // Notifications for my points
      const userWhere = {};

      userWhere["notifications_settings.my_points.method"] = {
        $gt: 0
      };

      if (activity.post_id) {
        models.Post.find({
          where: {
            id: activity.post_id
          },
          include: [
            {
              model: models.Point,
              include: [
                {
                  model: models.User,
                  attributes: ['id','notifications_settings','email'],
                  where: userWhere,
                  required: true
                }
              ]
            }
          ]
        }).then((post) => {
          if (post) {
            const users = [];
            const userIds = [];
            async.eachSeries(post.Points, (point, innerSeriesCallback) => {
              if (!_.includes(userIds, point.User.id)) {
                users.push(point.User);
                userIds.push(point.User.id);
              }
              innerSeriesCallback();
            },  (error) => {
              addNotificationsForUsers(activity, users, notificationType, 'my_points', uniqueUserIds, seriesCallback);
            });
          } else {
            seriesCallback();
          }
        }).catch((error) => {
          seriesCallback(error);
        });
      } else {
        // No post associated with this point
        seriesCallback();
      }
    },

    (seriesCallback) => {
      if (activity.Community) {
        // Notifications for all new points in community
        getModelAndUsersByType(models.Community, 'CommunityUsers', activity.Community.id, "all_community", (error, community) => {
          if (error) {
            seriesCallback(error);
          } else if (community) {
            addNotificationsForUsers(activity, community.CommunityUsers, notificationType, 'all_community', uniqueUserIds, seriesCallback);
          } else {
            log.warn("Generate Point Notification Not found or muted", { userId: activity.user_id, type: activity.type});
            seriesCallback();
          }
        });
      } else {
        seriesCallback();
      }
    },

    (seriesCallback) => {
      if (activity.Group) {
        // Notifications for all new points in group
        getModelAndUsersByType(models.Group, 'GroupUsers', activity.Group.id, "all_group", (error, group) => {
          if (error) {
            seriesCallback(error);
          } else if (group) {
            addNotificationsForUsers(activity, group.GroupUsers, notificationType, "all_group", uniqueUserIds, seriesCallback);
          } else {
            log.warn("Generate Point Notification Not found or muted", { userId: activity.user_id, type: activity.type});
            seriesCallback();
          }
        });
      } else {
        seriesCallback();
      }
    }
  ], (error) => {
    callback(error);
  });

  // TODO: Add AcWatching community and group users
};

const generateNotificationsForHelpfulness = (activity, callback) => {
  // Notifications for quality on posts I've created
  models.Point.find({
    where: { id: activity.point_id },
    include: [
      {
        model: models.User,
        required: true,
        attributes: ['id','notifications_settings','email','name'],
        where: {
          "notifications_settings.my_points_endorsements.method": {
            $gt: 0
          }
        }
      }
    ]
  }).then((point) => {
    //TODO: do notifications for stories as well that are without a post_id
    if (point && point.post_id) {
      addOrPossiblyGroupNotification(point, 'notification.point.quality', 'my_points_endorsements', activity, point.User, 50, callback);
    } else {
      log.warn("Generate Point Notification Not found or muted", { userId: activity.user_id, type: activity.type});
      callback();
    }
  }).catch( (error) => {
    callback(error);
  });

  // TODO: Add AcWatching users
};

module.exports = (activity, user, callback) => {
  if (activity.type==='activity.point.new' ||
      activity.type==='activity.point.newsStory.new' ||
      activity.type==='activity.point.comment.new') {
    generateNotificationsForNewPoint(activity, callback);
  } else if (activity.type==='activity.point.helpful.new' || activity.type==='activity.point.unhelpful.new') {
//    generateNotificationsForHelpfulness(activity, callback)
    callback();
  } else {
    callback("Unexpected type for generatePointNotification");
  }
};
