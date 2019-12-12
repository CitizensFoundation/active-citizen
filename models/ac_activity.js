"use strict";

const log = require('../utils/logger');
const queue = require('../workers/queue');
const toJson = require('../utils/to_json');
const commonIndexForActivitiesAndNewsFeeds = require('../engine/news_feeds/activity_and_item_index_definitions').commonIndexForActivitiesAndNewsFeeds;
const _ = require('lodash');

module.exports = (sequelize, DataTypes) => {
  const AcActivity = sequelize.define("AcActivity", {
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
        deleted: false,
        status: 'active'
      }
    },

    timestamps: true,

    indexes: _.concat(commonIndexForActivitiesAndNewsFeeds('created_at'), [
      {
        name: 'activity_active_by_type',
        fields: ['type'],
        where: {
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
        name: 'ac_activities_idx_post_id_user_id_type_delete_status',
        fields: ['post_id','user_id','type','deleted']
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
        name: 'userid_groupid_deleted',
        fields: ['user_id','group_id','deleted']
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
        name: 'activity_all_by_type',
        fields: ['type']
      }
    ]),

    underscored: true,

    tableName: 'ac_activities'
  });

  AcActivity.associate = (models) => {
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
  };

  AcActivity.ACCESS_PUBLIC = 0;
  AcActivity.ACCESS_COMMUNITY = 1;
  AcActivity.ACCESS_GROUP = 2;
  AcActivity.ACCESS_PRIVATE = 3;


  AcActivity.createActivity = (options, callback) => {
    queue.create('delayed-job', { type: 'create-priority-activity', workData: options }).priority('critical').removeOnComplete(true).save();
    callback();
  };

  AcActivity.createPasswordRecovery = (user, domain, community, token, done) => {
    sequelize.models.AcActivity.build({
      type: "activity.password.recovery",
      status: 'active',
      actor: { user: user },
      object: {
        domainId: domain.id,
        communityId: community ? community.id : null,
        token: token
      },
      domain_id: domain.id,
      community_id: community ? community.id : null,
      user_id: user.id,
      access: sequelize.models.AcActivity.ACCESS_PRIVATE
    }).save().then((activity)=> {
      if (activity) {
        queue.create('process-activity', activity).priority('critical').removeOnComplete(true).save();
        log.info('Activity Created', { activity: toJson(activity), user: toJson(user) });
        done(null);
      } else {
        done('Activity Not Found');
      }
    }).catch((error) => {
      log.error('Activity Created Error', { err: error });
      done(error);
    });
  };

  AcActivity.inviteCreated = (options, done) => {
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
    }).save().then((activity) => {
      if (activity) {
        queue.create('process-activity', activity).priority('critical').removeOnComplete(true).save();
        log.info('Activity Created', { activity: toJson(activity), userId: options.user_id, email: options.email });
        done(null);
      } else {
        done('Activity Not Found');
      }
    }).catch((error) => {
      log.error('Activity Created Error', { err: error });
      done(error);
    });
  };

  return AcActivity;
};
