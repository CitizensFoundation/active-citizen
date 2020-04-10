const queue = require('../../workers/queue');
const models = require("../../../models");
const i18n = require('../../utils/i18n');
const async = require('async');
const moment = require('moment');
const log = require('../../utils/logger');
const _ = require('lodash');

const getGroupPosts = require('./common_utils').getGroupPosts;
const getRatingHeaders = require('./common_utils').getRatingHeaders;
const getContactData = require('./common_utils').getContactData;
const getAttachmentData = require('./common_utils').getAttachmentData;
const getMediaTranscripts = require('./common_utils').getMediaTranscripts;
const getPostRatings = require('./common_utils').getPostRatings;
const getPostUrl =  require('./common_utils').getPostUrl;
const getLocation =  require('./common_utils').getLocation;
const getCategory =  require('./common_utils').getCategory;
const getUserEmail = require('./common_utils').getUserEmail;


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