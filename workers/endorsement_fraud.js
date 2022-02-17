const async = require("async");
const models = require("../../models");
const log = require('../utils/logger');
const queue = require('./queue');
const i18n = require('../utils/i18n');
const toJson = require('../utils/to_json');
const _ = require('lodash');

const getData = require('../engine/moderation/endorsementFraudGet').getData;
const deleteJob = require('../engine/moderation/endorsementFraudGet').deleteJob;

let airbrake = null;
if(process.env.AIRBRAKE_PROJECT_ID) {
  airbrake = require('../utils/airbrake');
}

let EndorsementFraudActionWorker = function () {};

EndorsementFraudActionWorker.prototype.process = (workPackage, callback) => {
  switch (workPackage.type) {
    case 'delete-job':
      deleteJob(workPackage, callback);
      break;
    case 'get-by-missing-fingerprint':
    case 'get-by-ip-address-user-agent-post-id':
    case 'get-by-ip-address':
      getData(workPackage, callback);
      break;
    default:
      callback("Unknown type for workPackage: " + workPackage.type);
  }
};

module.exports = new EndorsementFraudActionWorker();
