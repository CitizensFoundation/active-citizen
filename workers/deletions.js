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

const recountGroupFromPostId = (postId, callback) => {
  let postsCount = 0;
  let pointsCount = 0;

  models.Post.find({
    where: { id: postId },
    attributes: ['id', 'group_id']
  }).then((post) => {
    let groupId = post.group_id;
    async.series([
      function (seriesCallback) {
        models.Post.findAll({
          where: {
            group_id: groupId
          }
        }).then(function (posts) {
          postsCount = posts.length;
          seriesCallback();
        })
      },
      function (seriesCallback) {
        models.Point.findAll({
          include: [
            {
              model: models.Post,
              where: {
                group_id: groupId
              }
            }
          ]
        }).then(function (posts) {
          pointsCount = posts.length;
          seriesCallback();
        })
      }
    ], (error) => {
      if (error) {
        callback(error);
      } else {
        models.Group.find({where: { id: groupId }}).then((group) => {
          group.counter_posts = postsCount;
          group.counter_points = pointsCount;
          group.save().then(() => {
            callback();
          });
        }).catch((error) => {
          callback(error);
        });
      }
    });
  }).catch((error) => {
    callback(error);
  });
};

const resetCountForCommunityForGroup = (groupId, callback) => {
  let totalPosts=0, totalPoints = 0;
  models.Group.find({
    where: { id: groupId },
    attributes: ['id', 'community_id']
  }).then((group) => {
    let communityId = group.community_id;
    async.series([
      (seriesCallback) => {
        models.Group.findAll({
          where: { community_id: communityId },
          attributes: ['id', 'community_id','counter_points','counter_posts']
        }).then((groups) => {
          groups.forEach((group) => {
            if (group.counter_posts) {
              totalPosts+=group.counter_posts;
            }
            if (group.counter_points) {
              totalPoints+=group.counter_points;
            }
          });
          models.Community.update(
            { counter_posts:totalPosts, counter_points: totalPoints },
            { where: { id: communityId} }
          ).then(() => {
            seriesCallback();
          }).catch((error) => {
            seriesCallback(error)
          });
        }).catch((error) => {
          callback(error);
        });
      }
    ], (error) => {
      callback(error);
    });
  }).catch((error) => {
    callback(error)
  });
};

let DeletionWorker = function () {};

const deletePointContent = (workPackage, callback) => {
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
    callback("No pointId for deletePointContent");
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
            deletePointContent(_.merge({pointId: point.id, skipActivities: true}, workPackage), innerCallback);
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
      },
      (seriesCallback) => {
        if (workPackage.resetCounters) {
          models.Post.update(
            { counter_endorsements_up: 0, counter_endorsements_down: 0, counter_points: 0, counter_users: 0 },
            { where: { id: postId } }
          ).then(function () {
            log.info("Post reset counters for post");
            recountGroupFromPostId(postId, (error) => {
              seriesCallback(error);
            });
          }).catch((error) => {
            seriesCallback(error);
          });
        } else {
          seriesCallback();
        }
      }], (error) => {
        if (workPackage.useNotification) {
          models.Post.find({
            where: { id: postId },
            attributes: ['id', 'group_id'],
            include: [
              {
                model: models.Group,
                attributes: ['id','community_id'],
                include: [
                  {
                    model: models.Community,
                    attributes: ['id', 'domain_id']
                  }
                ]
              }
            ]
          }).then((post) => {
            const notificationType = error ? 'deletePostContentError' : 'deletePostContentDone';
            models.AcActivity.createActivity({
              type: 'activity.system.generalUserNotification',
              object: { type: notificationType, name: workPackage.postName, forwardToUser: true, offerReload: true },
              userId: workPackage.userId, postId: postId, groupId: post.Group.id, communityId: post.Group.Community.id,
              domainId: post.Group.Community.domain_id
            }, (subError) => {
              callback(error || subError);
            });
          }).catch((error) => {
            callback(error);
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
            deletePostContent(_.merge({postId: post.id, skipActivities: true, useNotification: false }, workPackage), innerCallback);
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
      },
      (seriesCallback) => {
        if (workPackage.resetCounters) {
          models.Group.update(
            { counter_posts: 0, counter_points: 0, counter_users: 0 },
            { where: { id: groupId } }
          ).then(function () {
            log.info("Group reset counters for group");
            resetCountForCommunityForGroup(groupId, seriesCallback);
          }).catch((error) => {
            seriesCallback(error);
          });
        } else {
          seriesCallback();
        }
      }], (error) => {
        if (workPackage.useNotification) {
          models.Group.find({
            where: { id: groupId },
            attributes: ['id', 'community_id'],
            include: [
              {
                model: models.Community,
                attributes: ['id', 'domain_id']
              }
            ]
          }).then((group) => {
            const notificationType = error ? 'deleteGroupContentError' : 'deleteGroupContentDone';
            models.AcActivity.createActivity({
              type: 'activity.system.generalUserNotification',
              object: { type: notificationType, name: workPackage.groupName, forwardToUser: true, offerReload: true },
              userId: workPackage.userId, groupId: group.id, communityId: group.Community.id, domainId: group.Community.domain_id
            }, (subError) => {
              callback(error || subError);
            });
          }).catch((error) => {
            callback(error);
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
      },
      (seriesCallback) => {
        if (workPackage.resetCounters) {
          models.Community.update(
            { counter_posts: 0, counter_points: 0, counter_groups: 0, counter_users: 0 },
            { where: { id: communityId } }
          ).then(function () {
            log.info("Community reset counters for community");
            seriesCallback();
          }).catch((error) => {
            seriesCallback(error);
          })
        } else {
          seriesCallback();
        }
      },
      (seriesCallback) => {
        models.Group.update(
          { deleted: true },
          { where: { community_id: communityId } }
        ).then(function () {
          log.info("Community groups deleted");
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        })
      }], (error) => {
        if (workPackage.useNotification) {
          models.Community.find({
            where: { id: communityId },
            attributes: ['id', 'domain_id']
          }).then((community) => {
            const notificationType = error ? 'deleteCommunityContentError' : 'deleteCommunityContentDone';
            models.AcActivity.createActivity({
              type: 'activity.system.generalUserNotification',
              object: { type: notificationType, name: workPackage.communityName, forwardToUser: true, offerReload: true },
              userId: workPackage.userId, communityId: community.id, domainId: community.domain_id
            }, (subError) => {
              callback(error || subError);
            });
          }).catch((error) => {
            callback(error);
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
    case 'delete-point-content':
      deletePointContent(workPackage, callback);
      break;
    case 'delete-post-content':
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
