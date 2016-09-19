"use strict";

var commonIndexForActivitiesAndNewsFeeds = require('../engine/news_feeds/activity_and_item_index_definitions').commonIndexForActivitiesAndNewsFeeds;

var _ = require('lodash');

// Notify user about this object

module.exports = function(sequelize, DataTypes) {

  var AcNewsFeedProcessedRange = sequelize.define("AcNewsFeedProcessedRange", {
    latest_activity_at: { type: DataTypes.DATE, allowNull: false },
    oldest_activity_at: { type: DataTypes.DATE, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
    deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  }, {

    defaultScope: {
      where: {
        status: 'active',
        deleted: false
      }
    },

    indexes: [
      {
        fields: ['id'],
        where: {
          deleted: false
        }
      },
      {
        name: 'latest_at_oldest_at',
        fields: ['latest_activity_at', 'oldest_activity_at'],
        where: {
          status: 'active',
          deleted: false
        }
      },
      {
        fields: ['latest_activity_at'],
        where: {
          status: 'active',
          deleted: false
        }
      },
      {
        fields: ['oldest_activity_at'],
        where: {
          status: 'active',
          deleted: false
        }
      }
    ],

    underscored: true,

    tableName: 'ac_news_feed_processed_ranges',

    classMethods: {

      associate: function(models) {
        AcNewsFeedProcessedRange.belongsTo(models.Domain);
        AcNewsFeedProcessedRange.belongsTo(models.Community);
        AcNewsFeedProcessedRange.belongsTo(models.Group);
        AcNewsFeedProcessedRange.belongsTo(models.Post);
        AcNewsFeedProcessedRange.belongsTo(models.User);
      }
    }
  });

  return AcNewsFeedProcessedRange;
};
