"use strict";

// Mute anything

module.exports = function(sequelize, DataTypes) {
  var AcMute = sequelize.define("AcMute", {
    deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  }, {

    defaultScope: {
      where: {
        deleted: false
      }
    },

    underscored: true,

    tableName: 'ac_mutes',

    classMethods: {

      associate: function(models) {
        AcMute.belongsTo(models.Domain);
        AcMute.belongsTo(models.Community);
        AcMute.belongsTo(models.Group);
        AcMute.belongsTo(models.Post);
        AcMute.belongsTo(models.Point);
        AcMute.belongsTo(models.User, { as: 'OtherUser' });
        AcMute.belongsTo(models.User);
      }
    }
  });

  return AcMute;
};
