"use strict";

// Currently using Sequelize and Postgresql for fastest possible implementataion.
// Those model classes should be refactored someday to support other database layers
// Ideally there should be a modular interface for the model layer. All activities are saved to
// elastic search through the logs. Based on https://www.w3.org/TR/activitystreams-core/

var async = require("async");
var log = require('../utils/logger');
var queue = require('../workers/queue');
var toJson = require('../utils/to_json');
var _ = require('lodash');

module.exports = function(sequelize, DataTypes) {
  var AcClientActivity = sequelize.define("AcClientActivity", {
    type: { type: DataTypes.STRING, allowNull: false },
    sub_type: { type: DataTypes.STRING, allowNull: true },
    domain_id: { type: DataTypes.INTEGER, allowNull: true },
    community_id: { type: DataTypes.INTEGER, allowNull: true },
    group_id: { type: DataTypes.INTEGER, allowNull: true },
    user_id: { type: DataTypes.INTEGER, allowNull: true },
    post_id: { type: DataTypes.INTEGER, allowNull: true },


    object: DataTypes.JSONB,
    actor: DataTypes.JSONB,
    target: DataTypes.JSONB,
    context: DataTypes.JSONB
  }, {

    timestamps: true,
    underscored: true,

    tableName: 'ac_client_activities',
  });

  return AcClientActivity;
};
