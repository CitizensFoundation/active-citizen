"use strict";

var commonIndexForActivitiesAndNewsFeeds = require('../engine/news_feeds/activity_and_item_index_definitions').commonIndexForActivitiesAndNewsFeeds;

var _ = require('lodash');

// Notify user about this object

module.exports = function(sequelize, DataTypes) {

  var AcNewsFeedItem = sequelize.define("AcNewsFeedItem", {
    type: { type: DataTypes.STRING, allowNull: false },
    latest_activity_at: { type: DataTypes.DATE, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
    deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  }, {

    defaultScope: {
      where: {
        status: 'active',
        deleted: false
      }
    },

    indexes: _.concat(commonIndexForActivitiesAndNewsFeeds('latest_activity_at'), [
      {
        fields: ['id'],
        where: {
          deleted: false
        }
      },
      {
        fields: ['ac_notification_id'],
        where: {
          status: 'active',
          deleted: false
        }
      },
      {
        fields: ['ac_activity_id'],
        where: {
          status: 'active',
          deleted: false
        }
      }
    ]),

    underscored: true,

    tableName: 'ac_news_feed_items',

    classMethods: {

      associate: function(models) {
        AcNewsFeedItem.belongsTo(models.Domain);
        AcNewsFeedItem.belongsTo(models.Community);
        AcNewsFeedItem.belongsTo(models.Group);
        AcNewsFeedItem.belongsTo(models.Post);
        AcNewsFeedItem.belongsTo(models.Point);
        AcNewsFeedItem.belongsTo(models.Promotion);
        AcNewsFeedItem.belongsTo(models.AcNotification);
        AcNewsFeedItem.belongsTo(models.AcActivity);
        AcNewsFeedItem.belongsTo(models.User);
      }
    }
  });

  return AcNewsFeedItem;
};
