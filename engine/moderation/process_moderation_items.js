const queue = require('../../workers/queue');
const models = require("../../../models");
const i18n = require('../../utils/i18n');
const async = require('async');
const moment = require('moment');
const log = require('../../utils/logger');
const _ = require('lodash');
const getAnonymousUser = require('../../utils/get_anonymous_system_user');
const domainIncludes = require('./get_moderation_items').domainIncludes;
const communityIncludes = require('./get_moderation_items').communityIncludes;
const groupIncludes = require('./get_moderation_items').groupIncludes;
const userIncludes = require('./get_moderation_items').userIncludes;

const moderationItemActionMaster = (req, res, options) => {
  getAnonymousUser((error, anonymousUser) => {
    if (error) {
      log.error("Error in getAnonymousUser in moderationItemsActionMaster", {error});
      res.sendStatus(500)
    } else {
      options.model.unscoped().find({
        where: {
          deleted: false,
          id: options.itemId
        },
        include: options.includes
      }).then(item => {
        if (item) {
          if (options.actionType==='delete') {
            item.deleted = true;
          } else if (options.actionType==='approve') {
            item.status = 'published';
          } else if (options.actionType==='block') {
            item.status = 'blocked';
          } else if (options.actionType==='anonymize') {
            item.user_id = anonymousUser.id;
          } else if (options.actionType==='clearFlags') {
            item.counter_flags = 0;
          }
          item.save().then( () => {
            log.info('Moderation Action Done', { item, options });
            if (options.itemType==='point') {
              if (options.actionType==='anonymize') {
                queue.create('process-anonymization', { type: 'anonymize-point-activities', pointId: options.itemId }).
                priority('high').removeOnComplete(true).save();
              } else if (options.actionType==='delete') {
                queue.create('process-deletion', { type: 'delete-point-activities', postId: options.itemId }).
                priority('high').removeOnComplete(true).save();
              }
            } else if (options.itemType==='post') {
              if (options.actionType==='anonymize') {
                queue.create('process-anonymization', { type: 'anonymize-post-activities', pointId: options.itemId }).
                priority('high').removeOnComplete(true).save();
              } else if (options.actionType==='delete') {
                queue.create('process-deletion', { type: 'delete-post-activities', postId: options.itemId }).
                priority('high').removeOnComplete(true).save();
              }
            }
            res.sendStatus(200);
          }).catch( error => {
            log.error("Error deleting moderated item", { error });
            res.sendStatus(500);
          });
        } else {
          log.error("Can't find item", { options });
          res.sendStatus(404);
        }
      }).catch(error => {
        log.error("Error deleting moderated item", { error });
        res.sendStatus(500);
      })
    }
  });
};

const createActivityJob = (workPackage, model) => {
  if (workPackage.itemType==='post') {
    if (workPackage.actionType==='anonymize') {
      queue.create('process-anonymization', { type: 'anonymize-post-activities', postId: model.id }).
      priority('high').removeOnComplete(true).save();
    } else if (workPackage.actionType==='delete') {
      queue.create('process-deletion', { type: 'delete-post-activities', postId: model.id }).
      priority('high').removeOnComplete(true).save();
    }
  } else if (workPackage.itemType==='point') {
    if (workPackage.actionType==='anonymize') {
      queue.create('process-anonymization', { type: 'anonymize-point-activities', pointId: model.id }).
      priority('high').removeOnComplete(true).save();
    } else if (workPackage.actionType==='delete') {
      queue.create('process-deletion', { type: 'delete-point-activities', pointId: model.id }).
      priority('high').removeOnComplete(true).save();
    }
  }
};

const preProcessActivities = (workPackage, callback) => {
  async.forEachLimit(workPackage.itemIds, 20, (id, forEachCallback) => {
    workPackage.model.unscoped().find(
      {
        where: {
          id: id
        },
        include: workPackage.includes
      }).then((model) => {
      if (model) {
        createActivityJob(workPackage, model);
        forEachCallback();
      } else {
        log.error("Trying to change activities on an unknown item");
        forEachCallback();
      }
    }).catch(error => {
      forEachCallback(error);
    });
  }, error => {
    callback(error);
  })
};

const moderationManyItemsActionMaster = (workPackage, callback) => {
  getAnonymousUser((error, anonymousUser) => {
    if (error) {
      log.error("Error in getAnonymousUser in moderationItemsActionMaster", {error});
      callback(error);
    } else {
      let updateValues;
      if (workPackage.actionType==='delete') {
        updateValues = {
          deleted: true
        };
      } else if (workPackage.actionType==='approve') {
        updateValues = {
          status: 'published'
        };
      } else if (workPackage.actionType==='block') {
        updateValues = {
          status: 'blocked'
        };
      } else if (workPackage.actionType==='anonymize') {
        updateValues = {
          user_id: anonymousUser.id
        };
      } else if (workPackage.actionType==='clearFlags') {
        updateValues = {
          counter_flags: 0
        };
      }
      if (updateValues) {
        preProcessActivities(workPackage, (error) => {
          if (error) {
            callback(error);
          } else {
            workPackage.model.unscoped().update(
              updateValues,
              {
                where: {
                  deleted: false,
                  id: {
                    $in: workPackage.itemIds
                  }
                },
                include: workPackage.includes
              }).then((spread, other) => {
              log.info('Moderation Action Many', { spread, workPackage });
              callback();
            }).catch(error => {
              callback(error);
            })
          }
        });
      } else {
        callback("Couldn't find update values")
      }
    }
  });
};

const performSingleModerationAction = (req, res, options) => {
  let includes, model;

  if (options.domainId) {
    includes = domainIncludes(options.domainId);
  } else if (options.communityId) {
    includes = communityIncludes(options.communityId);
  } else if (options.groupId) {
    includes = groupIncludes(options.groupId);
  } else if (options.userId) {
    includes =  userIncludes(options.userId);
  }  else {
    log.error("Missing model type", { options });
    res.sendStatus(500);
    return;
  }

  if (options.userId && (options.actionType!=='delete' && options.actionType!=='anonymize')) {
    log.error("Trying to call forbidden actions for user", { options });
    res.sendStatus(500);
    return;
  }

  if (options.itemType==='post') {
    model = models.Post;
  } else if (options.itemType==='point') {
    model = models.Point;
  }

  moderationItemActionMaster(req, res, { itemType: options.itemType, itemId: options.itemId, model, actionType: options.actionType, includes });


};

const performManyModerationActions = (workPackage, callback) => {
  const postItems = _.filter(workPackage.items, (item) => {
    return item.modelType === 'post';
  });

  const postIds = _.map(postItems, item => {
    return item.id
  });

  const pointItems = _.filter(workPackage.items, (item) => {
    return item.modelType === 'point';
  });

  const pointIds = _.map(pointItems, item => {
    return item.id
  });

  let includes;

  if (workPackage.domainId) {
    includes = domainIncludes(workPackage.domainId);
  } else if (workPackage.communityId) {
    includes = communityIncludes(workPackage.communityId);
  } else if (workPackage.groupId) {
    includes = groupIncludes(workPackage.groupId);
  } else if (workPackage.userId) {
    includes = userIncludes(workPackage.userId);
  }  else {
    callback("Wrong action parameters", workPackage);
    return;
  }

  const pointWorkPackage = _.cloneDeep(workPackage);
  const postWorkPackage = _.cloneDeep(workPackage);

  async.parallel([
    parallelCallback => {
      if (postIds && postIds.length>0) {
        moderationManyItemsActionMaster(_.merge(postWorkPackage, { itemType: 'post', model: models.Post, includes, itemIds: postIds }), parallelCallback);
      } else {
        parallelCallback();
      }
    },
    parallelCallback => {
      if (pointIds && pointIds.length>0) {
        moderationManyItemsActionMaster(_.merge(pointWorkPackage, { itemType: 'point', model: models.Point, includes, itemIds: pointIds }), parallelCallback);
      } else {
        parallelCallback();
      }
    }
    ], error => {
      callback(error);
    }
  );
};

module.exports = {
  performSingleModerationAction,
  performManyModerationActions
};