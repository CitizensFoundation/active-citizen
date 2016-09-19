var queue = require('../../workers/queue');
var models = require("../../../models");
var i18n = require('../../utils/i18n');
var filterNotificationForDelivery = require('./emails_utils').filterNotificationForDelivery;

module.exports = function (notification, user, callback) {
  var post = notification.AcActivities[0].Post;
  var postName = post ? post.name : "?";

  if (notification.type=='notification.post.new') {
    filterNotificationForDelivery(notification, user, 'post_activity', { translateToken: 'notification.email.postNew', contentName: postName }, callback);
  } else if (notification.type=='notification.post.endorsement') {
    var subjectTranslateToken = (notification.AcActivities[0].type.indexOf('activity.post.endorsement') > -1) ? 'notification.email.postEndorsement' : 'notification.email.postOpposition';
    filterNotificationForDelivery(notification, user, 'post_activity', { translateToken: subjectTranslateToken, contentName: postName }, callback);
  } else {
    callback();
  }
};
