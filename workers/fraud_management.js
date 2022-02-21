const async = require("async");
const models = require("../../models");
const log = require('../utils/logger');
const queue = require('./queue');
const i18n = require('../utils/i18n');
const toJson = require('../utils/to_json');
const _ = require('lodash');
const FraudGetEndorsements = require("../engine/moderation/fraud/FraudGetEndorsements");
const FraudGetRatings = require("../engine/moderation/fraud/FraudGetRatings");

//const getData = require('../engine/moderation/fraud/endorsementFraudGet').getData;
const deleteJob = require('../engine/moderation/fraud/endorsementFraudGet').deleteJob;
const deleteItems = require('../engine/moderation/fraud/endorsementFraudDelete').deleteItems;;

let airbrake = null;
if(process.env.AIRBRAKE_PROJECT_ID) {
  airbrake = require('../utils/airbrake');
}

let FraudManagementWorker = function () {};

const ProcessFraudGet = async (workPackage, done) => {
  let fraudGetEngine;

  try {
    switch (workPackage.collectionType) {
      case "endorsements":
        fraudGetEngine = new FraudGetEndorsements(workPackage);
        break;
      case "ratings":
        fraudGetEngine = new FraudGetRatings(workPackage);
        break;
    }

    await fraudGetEngine.processAndGetFraudItems();
    done();
  } catch (error) {
    console.error(error);
    await models.AcBackgroundJob.updateErrorAsync(workPackage.jobId, error);
    done(error);
  }
}

FraudManagementWorker.prototype.process = async (workPackage, callback) => {
  switch (workPackage.type) {
    case 'delete-one-item':
    case 'delete-items':
      deleteItems(workPackage, callback);
      break;
    case 'delete-job':
      await models.AcBackgroundJob.destroyJobAsync(workPackage.jobId);
      callback();
      break;
    case 'get-items':
      await ProcessFraudGet(workPackage, callback);
      break;
    default:
      callback("Unknown type for workPackage: " + workPackage.type);
  }
};

module.exports = new FraudManagementWorker();
