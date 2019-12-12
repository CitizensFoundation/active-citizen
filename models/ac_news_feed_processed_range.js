"use strict";

module.exports = (sequelize, DataTypes) => {
  const AcNewsFeedProcessedRange = sequelize.define("AcNewsFeedProcessedRange", {
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

    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

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

    tableName: 'ac_news_feed_processed_ranges'
  });

  AcNewsFeedProcessedRange.associate = (models) => {
    AcNewsFeedProcessedRange.belongsTo(models.Domain);
    AcNewsFeedProcessedRange.belongsTo(models.Community);
    AcNewsFeedProcessedRange.belongsTo(models.Group);
    AcNewsFeedProcessedRange.belongsTo(models.Post);
    AcNewsFeedProcessedRange.belongsTo(models.User);
  };

  return AcNewsFeedProcessedRange;
};
