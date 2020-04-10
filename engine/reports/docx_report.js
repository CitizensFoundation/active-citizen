const queue = require('../../workers/queue');
const models = require("../../../models");
const i18n = require('../../utils/i18n');
const async = require('async');
const moment = require('moment');
const log = require('../../utils/logger');
const _ = require('lodash');

const createReport = (options, callback) => {
  getAllModeratedItemsByMaster(_.merge(options, {includes: userIncludes(options.userId) }), callback);
};

module.exports = {
  createReport
};