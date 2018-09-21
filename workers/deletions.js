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

let DeletionWorker = function () {};

const deletePointActivities = (workPackage, callback) => {
  const pointId = workPackage.pointId;
  log.info('Starting Point Activities Delete', {pointId: pointId, context: 'ac-delete', userId: workPackage.userId});
  if (pointId) {
    async.series([
      (seriesCallback) => {
      if (!workPackage.skipActivities) {
        models.AcActivity.update(
          { deleted: true },
          { where: { point_id: pointId}}
        ).then(function (spread) {
          log.info('Point Activities Deleted', {pointId: pointId, numberDeleted: spread[0],context: 'ac-delete', userId: workPackage.userId});
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
          { deleted: true },
          { where: { point_id: pointId}}
        ).then(function (spread) {
          log.info('Point Quality Deleted', {pointId: pointId, numberDeleted: spread[0],context: 'ac-delete', userId: workPackage.userId});
          seriesCallback();
        }).catch(function (error) {
          seriesCallback(error);
        });
      }
    ], (error) => {
      callback(error);
    });
  } else {
    callback("No pointId for deletePointActivities");
  }
};

const deletePostContent = (workPackage, callback) => {
  const postId = workPackage.postId;
  log.info('Starting Post Activities Delete', {postId: postId, context: 'ac-delete', userId: workPackage.userId});
  if (postId) {
    async.series([
      (seriesCallback) => {
        if (!workPackage.skipActivities) {
          models.AcActivity.update(
            { deleted: true },
            { where: { post_id: postId}}
          ).then((spread) => {
            log.info('Post Activities Deleted', {postId: postId, numberDeleted: spread[0],context: 'ac-delete', userId: workPackage.userId});
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
            deletePointActivities(_.merge({pointId: point.id, skipActivities: true}, workPackage), innerCallback);
          }, (error) => {
            seriesCallback(error);
          })

        }).catch((error) => {
          seriesCallback(error);
        });
      },
      (seriesCallback) => {
        models.Point.update(
          { deleted: true },
          { where: { post_id: postId } }
        ).then((spread) => {
          log.info('Post Activities Points Deleted', {postId: postId, numberDeleted: spread[0],context: 'ac-delete', userId: workPackage.userId});
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        })
      },
      (seriesCallback) => {
        models.Endorsement.update(
          { deleted: true },
          { where: { post_id: postId } }
        ).then((spread) => {
          log.info('Post Endorsement Deleted', { postId: postId, numberDeleted: spread[0],context: 'ac-delete', userId: workPackage.userId});
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        })
      }
      ], (error) => {
        if (workPackage.useNotification) {
          const notificationType = error ? 'deletePostContentError' : 'deletePostContent';
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
    callback("No postId for deletePostContent");
  }
};

const deleteGroupContent = (workPackage, callback) => {
  const groupId = workPackage.groupId;
  let allPosts = null;
  log.info('Starting Group Activities Delete', {groupId: groupId, context: 'ac-delete', userId: workPackage.userId});
  if (groupId) {
    async.series([
      (seriesCallback) => {
        models.AcActivity.update(
          { deleted: true },
          { where: { group_id: groupId }}
        ).then((spread) => {
          log.info('Group Activities Deleted', {groupId: groupId, numberDeleted: spread[0],context: 'ac-delete', userId: workPackage.userId});
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
            deletePostContent(_.merge({postId: post.id, skipActivities: true}, workPackage), innerCallback);
          }, (error) => {
            seriesCallback(error);
          });
        }).catch((error) => {
          seriesCallback(error);
        })
      },
      (seriesCallback) => {
        models.Post.update(
          { deleted: true },
          { where: { group_id: groupId } }
        ).then((spread) => {
          log.info('Group Activities Post Deleted', {groupId: groupId, numberDeleted: spread[0],context: 'ac-delete', userId: workPackage.userId});
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        })
      }
      ], (error) => {
        if (workPackage.useNotification) {
          const notificationType = error ? 'deleteCommunityContentError' : 'deleteCommunityContent';
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
    callback("No groupId for deleteGroupContent");
  }
};

const deleteCommunityContent = (workPackage, callback) => {
  const communityId = workPackage.communityId;
  log.info('Starting Community Activities Delete', {communityId: communityId, context: 'ac-delete', userId: workPackage.userId});
  if (communityId) {
    async.series([
      (seriesCallback) => {
        models.AcActivity.update(
          { deleted: true },
          { where: { community_id: communityId }}
        ).then(function (spread) {
          log.info('Community Activities Deleted', {communityId: communityId, numberDeleted: spread[0],context: 'ac-delete', userId: workPackage.userId});
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
            queue.create('process-deletion', { type: 'delete-group-content', userId: workPackage.userId, groupId: group.id }).priority('high').removeOnComplete(true).save();
          });
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        })
      }], (error) => {
        if (workPackage.useNotification) {
          const notificationType = error ? 'deleteCommunityContentError' : 'deleteCommunityContent';
          models.AcActivity.createActivity({
            type: 'activity.system.generalUserNotification',
            object: { type: notificationType, name: workPackage.communityName, forwardToUser: true },
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
    callback("No communityId for deleteCommunityContent");
  }
};

DeletionWorker.prototype.process = (workPackage, callback) => {
  switch(workPackage.type) {
    case 'delete-point-activities':
      deletePointActivities(workPackage, callback);
      break;
    case 'delete-post-activities':
      deletePostContent(workPackage, callback);
      break;
    case 'delete-group-content':
      deleteGroupContent(workPackage, callback);
      break;
    case 'delete-community-content':
      deleteCommunityContent(workPackage, callback);
      break;
    default:
      callback("Unknown type for workPackage");
  }
};

module.exports = new DeletionWorker();
