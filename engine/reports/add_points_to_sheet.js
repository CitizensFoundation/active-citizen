const queue = require("../../workers/queue");
const models = require("../../../models");
const i18n = require("../../utils/i18n");
const async = require("async");
const moment = require("moment");
const log = require("../../utils/logger");
const _ = require("lodash");
const fs = require("fs");
const Excel = require("exceljs");

const getGroupPosts = require("./common_utils").getGroupPosts;
const getContactData = require("./common_utils").getContactData;
const getAttachmentData = require("./common_utils").getAttachmentData;
const getMediaTranscripts = require("./common_utils").getMediaTranscripts;
const getPostRatings = require("./common_utils").getPostRatings;
const getPostUrl = require("./common_utils").getPostUrl;
const getLocation = require("./common_utils").getLocation;
const getCategory = require("./common_utils").getCategory;
const getUserEmail = require("./common_utils").getUserEmail;

const getMediaFormatUrl = require("./common_utils").getMediaFormatUrl;
const getMediaURLs = require("./common_utils").getMediaURLs;
const getPointsUpOrDown = require("./common_utils").getPointsUpOrDown;
const getPointsUp = require("./common_utils").getPointsUp;
const getPointsDown = require("./common_utils").getPointsDown;
const getPointMediaUrls = require("./common_utils").getPointMediaUrls;
const getTranslatedPoints = require("./common_utils").getTranslatedPoints;
const getTranslation = require("./common_utils").getTranslation;

const getOrderedPosts = require("./common_utils").getOrderedPosts;
const updateJobStatusIfNeeded = require("./common_utils")
  .updateJobStatusIfNeeded;
const setJobError = require("./common_utils").setJobError;

const preparePosts = require("./common_utils").preparePosts;

const uploadToS3 = require("./common_utils").uploadToS3;
const sanitizeFilename = require("sanitize-filename");
const getImageFromUrl = require("./common_utils").getImageFromUrl;

const getPointTextWithEverything = (group, post, point) => {
  let pointContent;
  let outText = "";
  if (post.translatedPoints && post.translatedPoints[point.id]) {
    pointContent = post.translatedPoints[point.id];
  } else {
    pointContent =
      point.PointRevisions[point.PointRevisions.length - 1].content;
  }

  outText = pointContent.trim() + "\n\n";

  if (
    point.public_data &&
    point.public_data.admin_comment &&
    point.public_data.admin_comment.text
  ) {
    outText +=
      (group.translatedCustomAdminCommentsTitle ||
        group.configuration.customAdminCommentsTitle ||
        "Admin comment") + "\n";

    if (point.public_data.admin_comment.createdAt) {
      outText +=
        moment(point.created_at).format("DD/MM/YY HH:mm") +
        " - " +
        point.public_data.admin_comment.userName +
        "\n\n";
    }

    let text =
      (post.translatedPoints &&
        post.translatedPoints[point.id + "adminComments"]) ||
      point.public_data.admin_comment.text ||
      "";

    outText += text + "\n\n";
  }

  return outText.trim();
};

const getPointValueText = (value) => {
  if (value===0) {
    return "Comment";
  } else if (value>0) {
    return "Point for";
  } else {
    return "Point against";
  }
}

const addPostPointsToSheet = (worksheet, post, group) => {
  post.Points.forEach(point=>{
    const row = {
      groupId: group.id,
      postId: post.realPost.id,
      postName: post.translatedName ? post.translatedName : post.name,
      status: point.status,
      createdAt: moment(point.created_at).format("DD/MM/YY HH:mm"),
      email: point.User.email,
      userName: point.User.name,
      pointLocale: point.language,
      helpfulCount: point.counter_quality_up,
      unhelpfulCount: point.counter_quality_down,
      value: getPointValueText(point.value),
      pointContentLatest: getPointTextWithEverything(group, post, point),
      pointTranscript: getMediaTranscripts(point),
      mediaUrls: getPointMediaUrls(point)
    };

    worksheet.addRow(row);
  })
};

module.exports = {
  addPostPointsToSheet
};
