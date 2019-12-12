"use strict";

module.exports = (sequelize, DataTypes) => {
  const AcWatching = sequelize.define("AcWatching", {
    priority: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.INTEGER, allowNull: false },
    deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  }, {

    defaultScope: {
      where: {
        deleted: false
      }
    },

    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    underscored: true,

    tableName: 'ac_watching'
  });

  AcWatching.associate = (models) => {
    AcWatching.belongsTo(models.Domain);
    AcWatching.belongsTo(models.Community);
    AcWatching.belongsTo(models.Group);
    AcWatching.belongsTo(models.Post);
    AcWatching.belongsTo(models.Point);
    AcWatching.belongsTo(models.User, { as: 'WatchingUser' });
    AcWatching.belongsTo(models.User);
  };

  AcWatching.watchCommunity = function(community, user) {
  };

  return AcWatching;
};
