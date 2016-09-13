var queue = require('../../workers/queue');
var models = require("../../../models");
var i18n = require('../../utils/i18n');
var filterNotificationForDelivery = require('./emails_utils').filterNotificationForDelivery;

module.exports = function (notification, user, callback) {
  var post = notification.AcActivities[0].Post;
  var postName = post ? post.name : "?";

  if (notification.type=='notification.point.new') {
    filterNotificationForDelivery(notification, user, 'point_activity', { translateToken: 'notification.email.newPointOnMyPoint', contentName: postName }, callback);
  } else if (notification.type=='notification.point.quality') {
    filterNotificationForDelivery(notification, user, 'point_activity', { translateToken: 'notification.email.newPointQuality', contentName: postName }, callback);
  }
};
