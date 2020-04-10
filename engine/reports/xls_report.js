const queue = require('../../workers/queue');
const models = require("../../../models");
const i18n = require('../../utils/i18n');
const async = require('async');
const moment = require('moment');
const log = require('../../utils/logger');
const _ = require('lodash');



const createReport = (workPackage, callback) => {
  switch (workPackage.type) {
    case 'export-group':
      exportGroup(workPackage, callback);
      break;
    default:
      callback("Unknown type for createReport workPackage: " + workPackage.type);
  }
};

module.exports = {
  createReport
};