const async = require("async");
const models = require("../../models");
const log = require('../utils/logger');
const queue = require('./queue');
const i18n = require('../utils/i18n');
const toJson = require('../utils/to_json');
const _ = require('lodash');

let airbrake = null;
if(process.env.AIRBRAKE_PROJECT_ID) {
  airbrake = require('../utils/airbrake');
}

let DelayedJobWorker = function () {};

const delayedCreateActivityFromApp = (workPackage, callback) => {
  const workData = workPackage.workData;
  models.AcActivity.createActivity({
    type: 'activity.fromApp',
    sub_type: workData.body.type,
    actor: { appActor: workData.body.actor },
    object: { name: workData.body.object, target: workData.body.target ? JSON.parse(workData.body.target) : null },
    context: { pathName: workData.body.path_name, name: workData.body.context, eventTime: workData.body.event_time,
      sessionId: workData.body.sessionId, userAgent: workData.body.user_agent, server_timestamp: workData.body.server_timestamp },
    userId: workData.userId,
    domainId: workData.domainId,
    groupId: workData.groupId,
    communityId: workData.communityId,
    postId: workData.postId
  }, function (error) {
    if (error) {
      log.error('Create Activity Error', {context: 'createActivity', err: error, errorStatus: 500 });
      callback(error);
    } else {
      callback();
    }
  });
};

DelayedJobWorker.prototype.process = (workPackage, callback) => {
  switch (workPackage.type) {
    case 'create-activity-from-app':
      delayedCreateActivityFromApp(workPackage, callback);
      break;
    default:
      callback("Unknown type for workPackage: " + workPackage.type);
  }
};

module.exports = new DelayedJobWorker();
