const async = require("async");
const models = require("../../models");
const log = require('../utils/logger');
const queue = require('./queue');
const i18n = require('../utils/i18n');
const toJson = require('../utils/to_json');
const _ = require('lodash');
const fs = require('fs');
const estimateToxicityScoreForPost = require('../engine/moderation/toxicity_analysis').estimateToxicityScoreForPost;
const estimateToxicityScoreForPoint = require('../engine/moderation/toxicity_analysis').estimateToxicityScoreForPoint;
const estimateToxicityScoreForCollection = require('../engine/moderation/toxicity_analysis').estimateToxicityScoreForCollection;
const performManyModerationActions = require("../engine/moderation/process_moderation_items").performManyModerationActions;

let airbrake = null;
if(process.env.AIRBRAKE_PROJECT_ID) {
  airbrake = require('../utils/airbrake');
}

let ModerationWorker = function () {};

ModerationWorker.prototype.process = (workPackage, callback) => {
  switch (workPackage.type) {
    case 'estimate-post-toxicity':
      estimateToxicityScoreForPost(workPackage, callback);
      break;
    case 'estimate-point-toxicity':
      estimateToxicityScoreForPoint(workPackage, callback);
      break;
    case 'estimate-collection-toxicity':
      estimateToxicityScoreForCollection(workPackage, callback);
      break;
    case 'perform-many-moderation-actions':
      performManyModerationActions(workPackage, callback);
      break;
    default:
      callback("Unknown type for workPackage: " + workPackage.type);
  }
};

module.exports = new ModerationWorker();
