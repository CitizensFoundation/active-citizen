"use strict";

// Notify user about this object

module.exports = function(sequelize, DataTypes) {
  var AcFollowing = sequelize.define("AcFollowing", {
    value: { type: DataTypes.INTEGER },
    deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  }, {

    defaultScope: {
      where: {
        deleted: false
      }
    },
    indexes: [
      {
        fields: ['user_id'],
        where: {
          deleted: false
        }
      },
      {
        fields: ['other_user_id'],
        where: {
          deleted: false
        }
      },
      {
        fields: ['user_id','other_user_id'],
        where: {
          deleted: false
        }
      }
    ],

    underscored: true,

    tableName: 'ac_followings',

    classMethods: {

      associate: function(models) {
        AcFollowing.belongsTo(models.User);
        AcFollowing.belongsTo(models.User, { as: 'OtherUser' });
      }
    }
  });

  return AcFollowing;
};
