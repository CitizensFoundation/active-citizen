const async = require("async");
const models = require("../../models");
const log = require('../utils/logger');
const queue = require('./queue');
const i18n = require('../utils/i18n');
const toJson = require('../utils/to_json');
const _ = require('lodash');
const getAnonymousUser = require('../utils/get_anonymous_system_user');

let airbrake = null;
if(process.env.AIRBRAKE_PROJECT_ID) {
  airbrake = require('../utils/airbrake');
}

const recountGroupFromPostId = (postId, callback) => {
  let postsCount = 0;
  let pointsCount = 0;

  models.Post.unscoped().find({
    where: { id: postId },
    attributes: ['id', 'group_id']
  }).then((post) => {
    if (post) {
      let groupId = post.group_id;
      async.series([
        (seriesCallback) => {
          models.Post.findAll({
            where: {
              group_id: groupId
            }
          }).then(function (posts) {
            postsCount = posts.length;
            seriesCallback();
          }).catch((error) => {
            seriesCallback(error);
          });
        },
        (seriesCallback) => {
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
          }).catch((error) => {
            seriesCallback(error);
          });
        }
      ], (error) => {
        if (error) {
          callback(error);
        } else {
          models.Group.find({
            where: { id: groupId },
            attributes: ['id', 'community_id', 'counter_posts', 'counter_points']
          }).then((group) => {
            if (group) {
              group.counter_posts = postsCount;
              group.counter_points = pointsCount;
              group.save().then(() => {
                callback();
              }).catch((error) => {
                callback(error);
              });
            } else {
              log.warn("No group for update counters");
              callback();
            }
          }).catch((error) => {
            callback(error);
          });
        }
      });
    } else {
      log.warn("No post for update counters");
      callback();
    }
  }).catch((error) => {
    callback(error);
  });
};

const resetCountForCommunityForGroup = (groupId, callback) => {
  let totalPosts=0, totalPoints = 0;
  models.Group.unscoped().find({
    where: { id: groupId },
    attributes: ['id', 'community_id']
  }).then((group) => {
    if (group) {
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
              { counter_posts: totalPosts, counter_points: totalPoints },
              { where: { id: communityId } }
            ).then(() => {
              seriesCallback();
            }).catch((error) => {
              seriesCallback(error)
            });
          }).catch((error) => {
            seriesCallback(error);
          });
        }
      ], (error) => {
        callback(error);
      });
    } else {
      callback();
    }
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
          { where: { point_id: pointId} }
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
            { where: { post_id: postId} }
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
          attributes: ['id','post_id'],
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
            if (post) {
              const notificationType = error ? 'deletePostContentError' : 'deletePostContentDone';
              models.AcActivity.createActivity({
                type: 'activity.system.generalUserNotification',
                object: { type: notificationType, name: workPackage.postName, forwardToUser: true, offerReload: true },
                userId: workPackage.userId, postId: postId, groupId: post.Group.id, communityId: post.Group.Community.id,
                domainId: post.Group.Community.domain_id
              }, (subError) => {
                callback(error || subError);
              });
            } else {
              callback("Could not find post for notification in deletions");
            }
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
          { where: { group_id: groupId } }
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
            deletePostContent(_.merge({postId: post.id, skipActivities: true, useNotification: false, resetCounters: false }, workPackage), innerCallback);
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
            if (group) {
              const notificationType = error ? 'deleteGroupContentError' : 'deleteGroupContentDone';
              models.AcActivity.createActivity({
                type: 'activity.system.generalUserNotification',
                object: { type: notificationType, name: workPackage.groupName, forwardToUser: true, offerReload: true },
                userId: workPackage.userId, groupId: group.id, communityId: group.Community.id, domainId: group.Community.domain_id
              }, (subError) => {
                callback(error || subError);
              });

            } else {
              callback("Could not find group for notification in deletions");
            }
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
            if (community) {
              const notificationType = error ? 'deleteCommunityContentError' : 'deleteCommunityContentDone';
              models.AcActivity.createActivity({
                type: 'activity.system.generalUserNotification',
                object: { type: notificationType, name: workPackage.communityName, forwardToUser: true, offerReload: true },
                userId: workPackage.userId, communityId: community.id, domainId: community.domain_id
              }, (subError) => {
                callback(error || subError);
              });
            } else {
              callback("Could not find community for notifications in deletions");
            }
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

const deleteUserEndorsements = (workPackage, callback) => {
  models.Endorsement.findAll({
    attributes: ['id', 'post_id', 'deleted','value'],
    where: {
      user_id: workPackage.userId
    },
    include: [
      {
        model: models.Post,
        attributes: ['id', 'counter_endorsements_up', 'counter_endorsements_down']
      }
    ]
  }).then((endorsements) => {
    async.forEach(endorsements, (endorsement, forEachCallback) => {
      if (endorsement.value===1) {
        endorsement.Post.decrement('counter_endorsements_up');
      } else {
        endorsement.Post.decrement('counter_endorsements_down');
      }
      endorsement.deleted = true;
      endorsement.save().then( () => {
        forEachCallback();
      }).catch((error) => {
        forEachCallback(error);
      });
    }, (error) => {
      if (error) {
        callback(error);
      } else {
        log.info('User Endorsements Deleted', { context: 'ac-delete', userId: workPackage.userId});
        callback();
      }
    });
  }).catch((error) => {
    callback(error);
  });
};

const deleteUserGroupEndorsements = (workPackage, callback) => {
  models.Endorsement.findAll({
    attributes: ['id', 'post_id', 'deleted','value'],
    where: {
      user_id: workPackage.userId
    },
    include: [
      {
        model: models.Post,
        attributes: ['id', 'counter_endorsements_up', 'counter_endorsements_down'],
        where: {
          group_id: workPackage.groupId
        }
      }
    ]
  }).then((endorsements) => {
    async.forEach(endorsements, (endorsement, forEachCallback) => {
      if (endorsement.value===1) {
        endorsement.Post.decrement('counter_endorsements_up');
      } else {
        endorsement.Post.decrement('counter_endorsements_down');
      }
      endorsement.deleted = true;
      endorsement.save().then( () => {
        forEachCallback();
      }).catch((error) => {
        forEachCallback(error);
      });
    }, (error) => {
      if (error) {
        callback(error);
      } else {
        log.info('User Group Endorsements Deleted', { context: 'ac-delete', userId: workPackage.userId});
        callback();
      }
    });
  }).catch((error) => {
    callback(error);
  });
};

const moveUserEndorsements = (workPackage, callback) => {
  models.Endorsement.update(
    { user_id: workPackage.toUserId },
    { where: { user_id: workPackage.fromUserId } }
  ).then((spread) => {
    log.info('Endorsement Moved', { numberDeleted: spread[0],context: 'ac-move', fromUserId: workPackage.fromUserId, toUserId: workPackage.toUserId});
    callback();
  }).catch((error) => {
    callback(error);
  })
};

const deleteUserContent = (workPackage, callback) => {
  if (workPackage.userId && workPackage.anonymousUserId) {
    async.series([
      (seriesCallback) => {
        deleteUserEndorsements(workPackage, seriesCallback);
      },
      (seriesCallback) => {
        models.PointQuality.findAll({
          attributes: ['id', 'point_id', 'deleted','value'],
          where: {
            user_id: workPackage.userId
          },
          include: [
            {
              model: models.Point,
              attributes: ['id', 'counter_quality_up', 'counter_quality_down']
            }
          ]
        }).then(function (pointQualities) {
          async.forEach(pointQualities, function (pointQuality, forEachCallback) {
            if (pointQuality.value===1) {
              pointQuality.Point.decrement('counter_quality_up');
            } else {
              pointQuality.Point.decrement('counter_quality_down');
            }
            pointQuality.deleted = true;
            pointQuality.save().then(function () {
              forEachCallback();
            }).catch((error) => {
              forEachCallback(error);
            });
          }, function (error) {
            if (error) {
              seriesCallback(error);
            } else {
              log.info('User PointQuality Deleted', { context: 'ac-delete', userId: workPackage.userId});
              seriesCallback();
            }
          });
        }).catch((error) => {
          seriesCallback(error);
        });
      },
      (seriesCallback) => {
        models.Point.update(
          { deleted: true },
          { where: { user_id: workPackage.userId } }
        ).then((spread) => {
          log.info('User Points Deleted', { numberDeleted: spread[0],context: 'ac-delete', userId: workPackage.userId});
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        })
      },
      (seriesCallback) => {
        models.AcActivity.update(
          { deleted: true },
          { where: { user_id: workPackage.userId } }
        ).then((spread) => {
          log.info('User AcActitivies Deleted', { numberDeleted: spread[0],context: 'ac-delete', userId: workPackage.userId});
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        })
      },
      (seriesCallback) => {
        models.Post.update(
          { deleted: true },
          { where: { user_id: workPackage.userId } }
        ).then((spread) => {
          log.info('User Post Deleted', { numberDeleted: spread[0],context: 'ac-delete', userId: workPackage.userId});
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        })
      },
      (seriesCallback) => {
        models.Group.update(
          { user_id: workPackage.anonymousUserId },
          { where: { user_id: workPackage.userId } }
        ).then((spread) => {
          log.info('User Groups Anonymized', { numberDeleted: spread[0],context: 'ac-delete', userId: workPackage.userId});
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        })
      },
      (seriesCallback) => {
        models.Community.update(
          { user_id: workPackage.anonymousUserId, ip_address: '127.0.0.1' },
          { where: { user_id: workPackage.userId } }
        ).then((spread) => {
          log.info('User Communities Anonymized', { numberDeleted: spread[0],context: 'ac-delete', userId: workPackage.userId});
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        })
      }
     ], (error) => {
      callback(error);
    });
  } else {
    callback("No userId or workPackage.anonymousUserId");
  }
};

const deleteUserGroupContent = (workPackage, callback) => {
  if (workPackage.userId && workPackage.anonymousUserId && workPackage.groupId) {
    async.series([
      (seriesCallback) => {
        deleteUserGroupEndorsements(workPackage, seriesCallback);
      },
      (seriesCallback) => {
        models.PointQuality.findAll({
          attributes: ['id', 'point_id', 'deleted','value'],
          where: {
            user_id: workPackage.userId
          },
          include: [
            {
              model: models.Point,
              attributes: ['id', 'counter_quality_up', 'counter_quality_down'],
              required: true,
              where: {
                group_id: workPackage.groupId
              }
            }
          ]
        }).then(function (pointQualities) {
          async.forEach(pointQualities, function (pointQuality, forEachCallback) {
            if (pointQuality.value===1) {
              pointQuality.Point.decrement('counter_quality_up');
            } else {
              pointQuality.Point.decrement('counter_quality_down');
            }
            pointQuality.deleted = true;
            pointQuality.save().then(function () {
              forEachCallback();
            }).catch((error) => {
              forEachCallback(error);
            });
          }, function (error) {
            if (error) {
              seriesCallback(error);
            } else {
              log.info('User PointQuality Deleted', { context: 'ac-delete', userId: workPackage.userId});
              seriesCallback();
            }
          });
        }).catch((error) => {
          seriesCallback(error);
        });
      },
      (seriesCallback) => {
        models.Point.update(
          { deleted: true },
          { where: { user_id: workPackage.userId, group_id: workPackage.groupId } }
        ).then((spread) => {
          log.info('User Group Points Deleted', { numberDeleted: spread[0],context: 'ac-delete', userId: workPackage.userId});
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        })
      },
      (seriesCallback) => {
        models.AcActivity.update(
          { deleted: true },
          { where: { user_id: workPackage.userId, group_id: workPackage.groupId } }
        ).then((spread) => {
          log.info('User AcActitivies Deleted', { numberDeleted: spread[0],context: 'ac-delete', userId: workPackage.userId});
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        })
      },
      (seriesCallback) => {
        models.Post.update(
          { deleted: true },
          { where: { user_id: workPackage.userId, group_id: workPackage.groupId } }
        ).then((spread) => {
          log.info('User Post Deleted', { numberDeleted: spread[0],context: 'ac-delete', userId: workPackage.userId});
          seriesCallback();
        }).catch((error) => {
          seriesCallback(error);
        })
      }
    ], (error) => {
      callback(error);
    });
  } else {
    callback("No userId or anonymousUserId or groupId");
  }
};

const deleteUserCommunityContent = (workPackage, callback) => {
  if (workPackage.userId && workPackage.anonymousUserId && workPackage.communityId) {
    models.Community.find({
      attributes: ['id'],
      where: {
        id: workPackage.communityId
      },
      include: [
        {
          model: models.Group,
          attributes: ['id']
        }
      ]
    }).then( (community) => {
      const groupIds = _.map(community.Groups, (group) => {
        return group.id
      });
      async.forEach(groupIds, (groupId, forEachCallback) => {
        deleteUserGroupContent({
          userId: workPackage.userId,
          anonymousUserId: workPackage.anonymousUserId,
          groupId: groupId}, forEachCallback);
      }, (error) => {
        log.info("User Community Content Deleted", { error: error, context: 'ac-delete', userId: workPackage.userId});
        callback(error);
      });
    }).catch((error) => {
      callback(error);
    });
  } else {
    callback("No userId or anonymousUserId or communityId");
  }
};

const deleteUserDomainContent = (workPackage, callback) => {
  if (workPackage.userId && workPackage.anonymousUserId && workPackage.domainId) {
    models.Domain.find({
      attributes: ['id'],
      where: {
        id: workPackage.domainId
      },
      include: [
        {
          model: models.Community,
          attributes: ['id']
        }
      ]
    }).then( (domain) => {
      const communityIds = _.map(domain.Communities, (community) => {
        return community.id
      });
      async.forEach(communityIds, (communityId, forEachCallback) => {
        deleteUserCommunityContent({
          userId: workPackage.userId,
          anonymousUserId: workPackage.anonymousUserId,
          communityId: communityId }, forEachCallback);
      }, (error) => {
        log.info("User Domain Content Deleted", { error: error, context: 'ac-delete', userId: workPackage.userId});
        callback(error);
      });
    }).catch((error) => {
      callback(error);
    });
  } else {
    callback("No userId or anonymousUserId or domainId");
  }
};

DeletionWorker.prototype.process = (workPackage, callback) => {
  getAnonymousUser((error, anonymousUser) => {
    if (error) {
      callback(error);
    } else {
      workPackage = _.merge({anonymousUserId: anonymousUser.id}, workPackage);
      switch (workPackage.type) {
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
        case 'delete-user-content':
          deleteUserContent(workPackage, callback);
          break;
        case 'delete-group-user-content':
          deleteUserGroupContent(workPackage, callback);
          break;
        case 'delete-community-user-content':
          deleteUserCommunityContent(workPackage, callback);
          break;
        case 'delete-domain-user-content':
          deleteUserDomainContent(workPackage, callback);
          break;
        case 'delete-user-endorsements':
          deleteUserEndorsements(workPackage, callback);
          break;
        case 'move-user-endorsements':
          moveUserEndorsements(workPackage, callback);
          break;
        default:
          callback("Unknown type for workPackage: "+workPackage.type);
      }
    }
  });
};

module.exports = new DeletionWorker();
