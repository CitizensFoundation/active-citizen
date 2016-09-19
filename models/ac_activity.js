"use strict";

// Currently using Sequelize and Postgresql for fastest possible implementataion.
// Those model classes should be refactored someday to support other database layers
// Ideally there should be a modular interface for the model layer. All activities are saved to
// elastic search through the logs. Based on https://www.w3.org/TR/activitystreams-core/

var async = require("async");
var log = require('../utils/logger');
var queue = require('../workers/queue');
var toJson = require('../utils/to_json');
var commonIndexForActivitiesAndNewsFeeds = require('../engine/news_feeds/activity_and_item_index_definitions').commonIndexForActivitiesAndNewsFeeds;
var _ = require('lodash');

var setupDefaultAssociations = function (activity, user, domain, community, group, done) {
  async.parallel([
    function(callback) {
      activity.setDomain(domain).then(function (results) {
        callback(results ? null : true);
      });
    },
    function(callback) {
      if (user) {
        activity.setUser(user).then(function (results) {
          callback(results ? null : true);
        });
      } else {
        callback();
      }
    },
    function(callback) {
      if (community) {
        activity.setCommunity(community).then(function (results) {
          callback(results ? null : true);
        });
      } else {
        callback();
      }
    },
    function(callback) {
      if (group) {
        activity.setGroup(group).then(function (results) {
          callback(results ? null : true);
        });
      } else {
        callback();
      }
    }
  ], function(error) {
    done(error)
  });
};

module.exports = function(sequelize, DataTypes) {
  var AcActivity = sequelize.define("AcActivity", {
    access: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    sub_type: { type: DataTypes.STRING, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: false },
    object: DataTypes.JSONB,
    actor: DataTypes.JSONB,
    target: DataTypes.JSONB,
    context: DataTypes.JSONB,
    user_interaction_profile: DataTypes.JSONB,
    deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  }, {

    defaultScope: {
      where: {
        deleted: false
      }
    },

    indexes: _.concat(commonIndexForActivitiesAndNewsFeeds('created_at'), [
      {
        name: 'activity_public_and_active_by_type',
        fields: ['type'],
        where: {
          access: 0,
          status: 'active',
          deleted: false
        }
      },
      {
        name: 'activity_active_by_type',
        fields: ['type'],
        where: {
          status: 'active',
          deleted: false
        }
      },
      {
        name: 'activity_public_and_active_by_domain_id',
        fields: ['domain_id'],
        where: {
          access: 0,
          status: 'active',
          deleted: false
        }
      },
      {
        name: 'activity_active_by_domain_id',
        fields: ['domain_id'],
        where: {
          status: 'active',
          deleted: false
        }
      },
      {
        name: 'activity_public_and_active_by_community_id',
        fields: ['community_id'],
        where: {
          access: 0,
          status: 'active',
          deleted: false
        }
      },
      {
        name: 'activity_active_by_community_id',
        fields: ['community_id'],
        where: {
          status: 'active',
          deleted: false
        }
      },
      {
        name: 'activity_public_and_active_by_group_id',
        fields: ['group_id'],
        where: {
          access: 0,
          status: 'active',
          deleted: false
        }
      },
      {
        name: 'activity_active_by_group_id',
        fields: ['group_id'],
        where: {
          status: 'active',
          deleted: false
        }
      },
      {
        name: 'activity_public_and_active_by_post_id',
        fields: ['post_id'],
        where: {
          access: 0,
          status: 'active',
          deleted: false
        }
      },
      {
        name: 'activity_active_by_post_id',
        fields: ['post_id'],
        where: {
          status: 'active',
          deleted: false
        }
      },
      {
        name: 'activity_active_by_type_and_user_id',
        fields: ['type','user_id'],
        where: {
          status: 'active',
          deleted: false
        }
      },
      {
        name: 'activity_active_by_user_id',
        fields: ['user_id'],
        where: {
          status: 'active',
          deleted: false
        }
      },
      {
        name: 'activity_all_by_type',
        fields: ['type']
      },
      {
        fields: ['object'],
        using: 'gin',
        operator: 'jsonb_path_ops'
      },
      {
        fields: ['actor'],
        using: 'gin',
        operator: 'jsonb_path_ops'
      },
      {
        fields: ['target'],
        using: 'gin',
        operator: 'jsonb_path_ops'
      },
      {
        fields: ['context'],
        using: 'gin',
        operator: 'jsonb_path_ops'
      },
      {
        fields: ['user_interaction_profile'],
        using: 'gin',
        operator: 'jsonb_path_ops'
      }
    ]),

    underscored: true,

    tableName: 'ac_activities',

    classMethods: {

      ACCESS_PUBLIC: 0,
      ACCESS_COMMUNITY: 1,
      ACCESS_GROUP: 2,
      ACCESS_PRIVATE: 3,

      associate: function(models) {
        AcActivity.belongsTo(models.Domain);
        AcActivity.belongsTo(models.Community);
        AcActivity.belongsTo(models.Group);
        AcActivity.belongsTo(models.Post);
        AcActivity.belongsTo(models.Point);
        AcActivity.belongsTo(models.Invite);
        AcActivity.belongsTo(models.User);
        AcActivity.belongsTo(models.Image);
        AcActivity.belongsTo(models.PostStatusChange);
        AcActivity.belongsToMany(models.User, { through: 'other_users' });
        AcActivity.belongsToMany(models.AcNotification, { as: 'AcActivities', through: 'notification_activities' });
      },

      createActivity: function(options, callback) {

        var context, actor, object;

        if (options.object)
          object = options.object;
        else
          object = {};

        if (options.context)
          context = options.context;
        else
          context = {};

        if (options.actor)
          actor = options.actor;
        else
          actor = {};

        if (options.userId)
          actor['userId'] = options.userId;

        if (options.domainId)
          object['domainId'] = options.domainId;

        if (options.communityId)
          object['communityId'] = options.communityId;

        if (options.groupId)
          object['groupId'] = options.groupId;

        if (options.postId)
          object['postId'] = options.postId;

        if (options.pointId)
          object['pointId'] = options.pointId;

        async.series([
          // Checking for missing values for community or group if its a post related event
          function (seriesCallback) {
            if (!options.postId || (options.groupId && options.communityId)) {
              seriesCallback();
            } else if (options.groupId) {
              sequelize.models.Group.find({where: { id: options.groupId },
                attributes: ['id','community_id']
              }).then(function(group) {
                if (group) {
                  log.info("Found group info for post acitivity from app");
                  options.communityId = group.community_id;
                  seriesCallback();
                } else {
                  seriesCallback("Can't find group");
                }
              }).catch(function(error) {
                seriesCallback(error);
              });
            } else if (options.postId) {
              log.info("Looking for post, group and community START");
              sequelize.models.Post.find({where: { id: options.postId },
                include: [
                  {
                    model: sequelize.models.Group,
                    attributes: ['id','community_id']
                  }
                ]}).then(function(post) {
                  log.info("Looking for post, group and community END");
                  if (post) {
                    log.info("Found post info for post acitivity from app");
                    options.groupId = post.Group.id;
                    options.communityId = post.Group.community_id;
                    seriesCallback();
                  } else {
                    seriesCallback("Can't find post");
                  }
                }).catch(function(error) {
                  seriesCallback(error);
                });
            } else {
              seriesCallback("Strange state of create ac activity looking up community id");
            }
          }
        ], function (error) {
          if (error) {
            callback(error);
          } else {
            sequelize.models.AcActivity.build({
              type: options.type,
              status: 'active',
              sub_type: options.subType,
              actor: actor,
              object: object,
              context: context,
              user_id: options.userId,
              domain_id: options.domainId,
              community_id: options.communityId,
              group_id: options.groupId,
              post_id: options.postId,
              point_id: options.pointId,
              post_status_change_id: options.postStatusChangeId,
              access: options.access ? options.access : sequelize.models.AcActivity.ACCESS_PRIVATE
            }).save().then(function(activity) {
              if (activity) {
                if (activity.type!='activity.fromApp') {
                  queue.create('process-activity', activity).priority('critical').removeOnComplete(true).save();
                }
                log.info('Activity Created', { activity: toJson(activity), userId: options.userId});
                callback();
              } else {
                callback('Activity Not Found');
              }
            }).catch(function(error) {
              log.error('Activity Created Error', { err: error });
              callback(error);
            });
          }
        });
      },

      createPasswordRecovery: function(user, domain, community, token, done) {
        sequelize.models.AcActivity.build({
          type: "activity.password.recovery",
          status: 'active',
          actor: { user: user },
          object: {
            domain: domain,
            community: community,
            token: token
          },
          domain_id: domain.id,
          community_id: community ? community.id : null,
          user_id: user.id,
          access: sequelize.models.AcActivity.ACCESS_PRIVATE
        }).save().then(function(activity) {
          if (activity) {
            queue.create('process-activity', activity).priority('critical').removeOnComplete(true).save();
            log.info('Activity Created', { activity: toJson(activity), user: toJson(user) });
            done(null);
          } else {
            done('Activity Not Found');
          }
        }).catch(function(error) {
          log.error('Activity Created Error', { err: error });
          done(error);
        });
      },

      inviteCreated: function(options, done) {
        sequelize.models.AcActivity.build({
          type: "activity.user.invite",
          status: 'active',
          actor: { user_id: options.user_id, sender_user_id: options.sender_user_id },
          object: {
            email: options.email,
            token: options.token,
            invite_id: options.invite_id,
            sender_name: options.sender_name
          },
          community_id: options.community_id,
          group_id: options.group_id,
          domain_id: options.domain_id,
          user_id: options.user_id,
          access: sequelize.models.AcActivity.ACCESS_PRIVATE
        }).save().then(function(activity) {
          if (activity) {
            queue.create('process-activity', activity).priority('critical').removeOnComplete(true).save();
            log.info('Activity Created', { activity: toJson(activity), userId: options.user_id, email: options.email });
            done(null);
          } else {
            done('Activity Not Found');
          }
       }).catch(function(error) {
          log.error('Activity Created Error', { err: error });
          done(error);
        });
      }
    }
  });

  return AcActivity;
};
