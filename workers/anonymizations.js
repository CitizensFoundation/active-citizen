const async = require("async");
const models = require("../../models");
const log = require('../utils/logger');
const queue = require('./queue');
const i18n = require('../utils/i18n');
const toJson = require('../utils/to_json');
const getAnonymousUser = require('../utils/get_anonymous_system_user');
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
            log.info('Point Activities Anonymized', {pointId: pointId, numberAnonymized: spread[0],context: 'ac-anonymize', userId: workPackage.userId});
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
          log.info('Point Quality Anonymized', {pointId: pointId, numberAnonymized: spread[0],context: 'ac-anonymize', userId: workPackage.userId});
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
            log.info('Post Activities Anonymized', {postId: postId, numberAnonymized: spread[0],context: 'ac-anonymize', userId: workPackage.userId});
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
          log.info('Post Activities Points Anonymized', {postId: postId, numberAnonymized: spread[0],context: 'ac-anonymize', userId: workPackage.userId});
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        })
      },
      (seriesCallback) => {
        models.Post.find({
            where: {
              id: postId,
              data: {
                $ne: null
              }
            },
            attribute: ['id', 'data']
          }
        ).then((post) => {
          if (post && post.data.contact) {
            post.set("data.contact", {});
            post.save().then(() => {
              seriesCallback();
            }).catch((error) => {
              seriesCallback(error);
            });
          } else {
            seriesCallback();
          }
        }).catch((error) => {
          seriesCallback(error);
        })
      },
      (seriesCallback) => {
        models.Endorsement.update(
          { user_id: workPackage.anonymousUserId },
          { where: { post_id: postId } }
        ).then((spread) => {
          log.info('Post Endorsement Anonymized', { postId: postId, numberAnonymized: spread[0],context: 'ac-anonymize', userId: workPackage.userId});
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        })
      }], (error) => {
        if (!workPackage.skipNotification) {
          models.Post.find({
            where: { id: postId },
            attributes: ['id'],
            include: [
              {
                model: models.Group,
                attributes: ['id','community_id'],
                include: [
                  {
                    model: models.Community,
                    attribues: ['id', 'domain_id']
                  }
                ]
              }
            ]
          }).then((post) => {
            const notificationType = error ? 'anonymizePostContentError' : 'anonymizePostContentDone';
            models.AcActivity.createActivity({
              type: 'activity.system.generalUserNotification',
              object: { type: notificationType, name: workPackage.postName, forwardToUser: true },
              userId: workPackage.userId, postId: post.id, groupId: post.Group.id, communityId: post.Group.Community.id,
              domainId: post.Group.Community.domain_id
            }, (subError) => {
              callback(error || subError);
            });
          }).catch((error) => {
            callback(error);
          })
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
          log.info('Group Activities Anonymized', {groupId: groupId, numberAnonymized: spread[0],context: 'ac-anonymize', userId: workPackage.userId});
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
            anonymizePostContent(_.merge({postId: post.id, skipActivities: true, skipNotification: true, useNotification: false }, workPackage), innerCallback);
          }, (error) => {
            seriesCallback(error);
          });
        }).catch((error) => {
          seriesCallback(error);
        })
      },
      (seriesCallback) => {
        models.Point.update(
          { user_id: workPackage.anonymousUserId },
          { where: { group_id: groupId }}
        ).then((spread) => {
          log.info('Group Points Anonymized', {groupId: groupId, numberAnonymized: spread[0],context: 'ac-anonymize', userId: workPackage.userId});
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        });
      },
      (seriesCallback) => {
        models.Point.findAll({
          where: { group_id: groupId },
          attributes: ['id', 'group_id'],
          include: [
            {
              model: models.PointRevision,
              required: true,
              attributes: ['id','user_id']
            }
          ]
        }).then((points) => {
          var pointRevisionsIds = [];
          points.forEach((point) => {
            let newIds = _.map(point.PointRevisions, (revision) => {
              return revision.id;
            });
            pointRevisionsIds = pointRevisionsIds.concat(newIds);
          });
          models.PointRevision.update(
            { user_id: workPackage.anonymousUserId },
            { where: {
                id: {
                  $in: pointRevisionsIds
                }
              }
            }
          ).then((spread) => {
            log.info('Group PointRevisions Anonymized', {groupId: groupId, numberAnonymized: spread[0], context: 'ac-anonymize', userId: workPackage.userId});
            seriesCallback();
          }).catch((error) => {
            seriesCallback(error);
          });
        }).catch((error) => {
          seriesCallback(error);
        });
      },
      (seriesCallback) => {
        models.Point.findAll({
          where: { group_id: groupId },
          attributes: ['id', 'group_id'],
          include: [
            {
              model: models.PointQuality,
              required: true,
              attributes: ['id','user_id']
            }
          ]
        }).then((points) => {
          var pointQualitiesIds = [];
          points.forEach((point) => {
            let newIds = _.map(point.PointQualities, (quality) => {
              return quality.id;
            });
            pointQualitiesIds = pointQualitiesIds.concat(newIds);
          });
          models.PointQuality.update(
            { user_id: workPackage.anonymousUserId },
            { where: {
                id: {
                  $in: pointQualitiesIds
                }
              }
            }
          ).then((spread) => {
            log.info('Group PointQuality Anonymized', {groupId: groupId, numberAnonymized: spread[0], context: 'ac-anonymize', userId: workPackage.userId});
            seriesCallback();
          }).catch((error) => {
            seriesCallback(error);
          });
        }).catch((error) => {
          seriesCallback(error);
        });
      },
      (seriesCallback) => {
        models.Post.update(
          { user_id: workPackage.anonymousUserId},
          { where: { group_id: groupId } }
        ).then((spread) => {
          log.info('Group Activities Post Anonymized', {groupId: groupId, numberAnonymized: spread[0],context: 'ac-anonymize', userId: workPackage.userId});
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        })
      }], (error) => {
        if (!workPackage.skipNotification) {
          models.Group.find(
            { where: { id: groupId },
              attributes: ['id','community_id'],
              include: [
                {
                  model: models.Community,
                  attribues: ['id','domain_id']
                }
              ]}
          ).then((group) => {
            const notificationType = error ? 'anonymizeGroupContentError' : 'anonymizeGroupContentDone';
            models.AcActivity.createActivity({
              type: 'activity.system.generalUserNotification',
              object: { type: notificationType, name: workPackage.groupName, forwardToUser: true },
              userId: workPackage.userId, groupId: group.id, communityId: group.community_id,
              domainId: group.Community.domain_id
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
          log.info('Community Activities Anonymized', {communityId: communityId, numberAnonymized: spread[0],context: 'ac-anonymize', userId: workPackage.userId});
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
        const notificationType = error ? 'anonymizeCommunityContentError' : 'anonymizeCommunityContentDone';
        models.Community.find({
          where: { id: communityId },
          attributes: ['id','domain_id']
        }).then(function (community) {
          models.AcActivity.createActivity({
            type: 'activity.system.generalUserNotification',
            object: { type: notificationType, name: workPackage.communityName, forwardToUser: true },
            userId: workPackage.userId, communityId: community.id, domainId: community.domain_id
          }, (subError) => {
            callback(error || subError);
          });
        }).catch((error) => {
          callback(error);
        });
      }
    );
  } else {
    callback("No communityId for anonymizeCommunityActivities");
  }
};

AnonymizationWorker.prototype.process = (workPackage, callback) => {
  getAnonymousUser((error, anonymousUser) => {
    if (error) {
      callback(error);
    } else {
      workPackage = _.merge({ anonymousUserId: anonymousUser.id }, workPackage);

      switch(workPackage.type) {
        case 'anonymize-post-content':
          anonymizePostContent(workPackage, callback);
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
