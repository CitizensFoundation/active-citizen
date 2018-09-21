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

let AnonymizationWorker = function () {};

const anonymizePointActivities = (workPackage, callback) => {
  const pointId = workPackage.pointId;
  log.info('Starting Point Activities Anonymized', {pointId: pointId, context: 'ac-anonymize', userId: workPackage.userId});
  if (pointId) {
    async.series([
      (seriesCallback) => {
        if (!workPackage.skipActivities) {
          models.AcActivity.update(
            { user_id: workPackage.anonymousUserId },
            { where: { point_id: pointId}}
          ).then(function (spread) {
            log.info('Point Activities Anonymized', {pointId: pointId, numberDeleted: spread[0],context: 'ac-anonymize', userId: workPackage.userId});
            seriesCallback();
          }).catch(function (error) {
            seriesCallback(error);
          });
        } else {
          seriesCallback();
        }
      },
      (seriesCallback) => {
        models.PointQuality.update(
          { user_id: workPackage.anonymousUserId },
          { where: { point_id: pointId}}
        ).then(function (spread) {
          log.info('Point Quality Anonymized', {pointId: pointId, numberDeleted: spread[0],context: 'ac-anonymize', userId: workPackage.userId});
          seriesCallback();
        }).catch(function (error) {
          seriesCallback(error);
        });
      }
    ], (error) => {
      callback(error);
    });
  } else {
    callback("No pointId for anonymizePointActivities");
  }
};

const anonymizePostContent = (workPackage, callback) => {
  const postId = workPackage.postId;
  log.info('Starting Post Content Anonymized', {postId: postId, context: 'ac-anonymize', userId: workPackage.userId});
  if (postId) {
    async.series([
      (seriesCallback) => {
        if (!workPackage.skipActivities) {
          models.AcActivity.update(
            { user_id: workPackage.anonymousUserId },
            { where: { post_id: postId}}
          ).then((spread) => {
            log.info('Post Activities Anonymized', {postId: postId, numberDeleted: spread[0],context: 'ac-anonymize', userId: workPackage.userId});
            seriesCallback();
          }).catch((error) => {
            seriesCallback(error);
          });
        } else {
          seriesCallback();
        }
      },
      (seriesCallback) => {
        models.Point.findAll({
          attributes: ['id'],
          where: {
            post_id: postId
          }
        }).then((points) => {
          async.forEach(points, (point, innerCallback) => {
            anonymizePointActivities(_.merge({pointId: point.id, skipActivities: true}, workPackage), innerCallback);
          }, (error) => {
            seriesCallback(error);
          })

        }).catch((error) => {
          seriesCallback(error);
        });
      },
      (seriesCallback) => {
        models.Point.update(
          { user_id: workPackage.anonymousUserId },
          { where: { post_id: postId } }
        ).then((spread) => {
          log.info('Post Activities Points Anonymized', {postId: postId, numberDeleted: spread[0],context: 'ac-anonymize', userId: workPackage.userId});
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        })
      },
      (seriesCallback) => {
        models.Endorsement.update(
          { user_id: workPackage.anonymousUserId },
          { where: { post_id: postId } }
        ).then((spread) => {
          log.info('Post Endorsement Anonymized', { postId: postId, numberDeleted: spread[0],context: 'ac-anonymize', userId: workPackage.userId});
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        })
      }], (error) => {
        if (!workPackage.skipNotification) {
          let notificationType = error ? 'anonymizePostContentError' : 'anonymizePostContent';
          models.AcActivity.createActivity({
            type: 'activity.system.generalUserNotification',
            object: { type: notificationType, name: workPackage.postTitle, forwardToUser: true },
            userId: workPackage.userId
          }, (subError) => {
            callback(error || subError);
          });
        } else {
          callback(error);
        }
      }
    );
  } else {
    callback("No postId for anonymizePostContent");
  }
};

const anonymizeGroupContent = (workPackage, callback) => {
  const groupId = workPackage.groupId;
  let allPosts = null;
  log.info('Starting Group Activities Anonymized', {groupId: groupId, context: 'ac-anonymize', userId: workPackage.userId});
  if (groupId) {
    async.series([
      (seriesCallback) => {
        models.AcActivity.update(
          { user_id: workPackage.anonymousUserId },
          { where: { group_id: groupId }}
        ).then((spread) => {
          log.info('Group Activities Anonymized', {groupId: groupId, numberDeleted: spread[0],context: 'ac-anonymize', userId: workPackage.userId});
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        });
      },
      (seriesCallback) => {
        models.Post.findAll({
          attributes: ['id'],
          where: { group_id: groupId }
        }).then(function (posts) {
          async.forEach(posts, function (post, innerCallback) {
            anonymizePostContent(_.merge({postId: post.id, skipActivities: true, skipNotification: true}, workPackage), innerCallback);
          }, (error) => {
            seriesCallback(error);
          });
        }).catch((error) => {
          seriesCallback(error);
        })
      },
      (seriesCallback) => {
        models.Post.update(
          { user_id: workPackage.anonymousUserId},
          { where: { group_id: groupId } }
        ).then((spread) => {
          log.info('Group Activities Post Anonymized', {groupId: groupId, numberDeleted: spread[0],context: 'ac-anonymize', userId: workPackage.userId});
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        })
      }], (error) => {
        if (!workPackage.skipNotification) {
          let notificationType = error ? 'anonymizeGroupContentError' : 'anonymizeGroupContent';
          models.AcActivity.createActivity({
            type: 'activity.system.generalUserNotification',
            object: { type: notificationType, name: workPackage.groupName, forwardToUser: true },
            userId: workPackage.userId
          }, (subError) => {
            callback(error || subError);
          });
        } else {
          callback(error);
        }
      }
    );
  } else {
    callback("No groupId for anonymizeGroupContent");
  }
};

const anonymizeCommunityContent = (workPackage, callback) => {
  const communityId = workPackage.communityId;
  log.info('Starting Community Activities Delete', {communityId: communityId, context: 'ac-anonymize', userId: workPackage.userId});
  if (communityId) {
    async.series([
       (seriesCallback) => {
        models.AcActivity.update(
          { user_id: workPackage.anonymousUserId },
          { where: { community_id: communityId }}
        ).then(function (spread) {
          log.info('Community Activities Anonymized', {communityId: communityId, numberDeleted: spread[0],context: 'ac-anonymize', userId: workPackage.userId});
          seriesCallback();
        }).catch(function (error) {
          seriesCallback(error);
        });
      },
      (seriesCallback) => {
        models.Group.findAll({
            attributes: ['id'],
            where: { community_id: communityId }
          }
        ).then(function (groups) {
          groups.forEach(function (group) {
            queue.create('process-anonymization', { type: 'anonymize-group-content', userId: workPackage.userId, skipNotification: true, groupId: group.id }).priority('high').removeOnComplete(true).save();
          });
          seriesCallback();
        }).catch(function (error) {
          seriesCallback(error);
        })
      }], (error) => {
      const notificationType = error ? 'anonymizeCommunityContentError' : 'anonymizeCommunityContent';
      models.AcActivity.createActivity({
          type: 'activity.system.generalUserNotification',
          object: { type: notificationType, name: workPackage.communityName, forwardToUser: true },
          userId: workPackage.userId
        }, (subError) => {
          callback(error || subError);
        });
      }
    );
  } else {
    callback("No communityId for anonymizeCommunityActivities");
  }
};

const getAnonymousUser = (callback) => {
  models.User.findOrCreate({
    where: {
      email: "system.anonymous.user72@citizens.is",
      frequency: frequency
    },
    defaults: {
      profile_data: { isAnonymousUser: true },
      email: "system.anonymous.user72@citizens.is",
      name: "Anonymous",
      notifications_settings: models.AcNotification.anonymousNotificationSettings,
      status: 'active'
    }
  }).spread(function(user) {
    callback(null, user);
  }).catch(function (error) {
    callback(error);
  });
};

AnonymizationWorker.prototype.process = (workPackage, callback) => {
  getAnonymousUser((error, anonymousUser) => {
    if (error) {
      callback(error);
    } else {
      workPackage = _.merge({ anonymousUserId: anonymousUser.id }, workPackage);

      switch(workPackage.type) {
        case 'anonymize-post-content':
          anonymizePost(workPackage, callback);
          break;
        case 'anonymize-group-content':
          anonymizeGroupContent(workPackage, callback);
          break;
        case 'anonymize-community-content':
          anonymizeCommunityContent(workPackage, callback);
          break;
        default:
          callback("Unknown type for workPackage");
      }
    }
  });
};

module.exports = new AnonymizationWorker();
