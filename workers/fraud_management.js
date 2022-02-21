const async = require("async");
const models = require("../../models");
const log = require('../utils/logger');
const queue = require('./queue');
const i18n = require('../utils/i18n');
const toJson = require('../utils/to_json');
const _ = require('lodash');

const getData = require('../engine/moderation/endorsementFraudGet').getData;
const deleteJob = require('../engine/moderation/endorsementFraudGet').deleteJob;
const deleteItems = require('../engine/moderation/endorsementFraudDelete').deleteItems;;

let airbrake = null;
if(process.env.AIRBRAKE_PROJECT_ID) {
  airbrake = require('../utils/airbrake');
}

let FraudManagementWorker = function () {};

FraudManagementWorker.prototype.process = (workPackage, callback) => {
  switch (workPackage.type) {
    case 'delete-one-item':
    case 'delete-items':
      deleteItems(workPackage, callback);
      break;
    case 'delete-job':
      deleteJob(workPackage, callback);
      break;
    case 'get-items':
      getData(workPackage, callback);
      break;
    default:
      callback("Unknown type for workPackage: " + workPackage.type);
  }
};

module.exports = new FraudManagementWorker();
