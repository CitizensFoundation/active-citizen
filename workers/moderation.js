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

let airbrake = null;
if(process.env.AIRBRAKE_PROJECT_ID) {
  airbrake = require('../utils/airbrake');
}

let ModerationWorker = function () {};

ModerationWorker.prototype.process = (workPackage, callback) => {
  if (process.env.GOOGLE_PERSPECTIVE_API_KEY) {
    switch (workPackage.type) {
      case 'estimate-post-toxicity':
        estimateToxicityScoreForPost(workPackage, callback);
        break;
      case 'estimate-post-transcript-toxicity':
        estimateToxicityScoreForPost(_.merge({useTranscript: true}, workPackage), callback);
        break;
      case 'estimate-point-toxicity':
        estimateToxicityScoreForPoint(workPackage, callback);
        break;
      case 'estimate-point-transcript-toxicity':
        estimateToxicityScoreForPoint(_.merge({useTranscript: true}, workPackage), callback);
        break;
      default:
        callback("Unknown type for workPackage: " + workPackage.type);
    }
  } else {
    log.debug("No GOOGLE_PERSPECTIVE_API_KEY");
    callback();
  }
};

module.exports = new ModerationWorker();
