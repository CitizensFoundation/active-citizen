import {domainIncludes, communityIncludes, groupIncludes, userIncludes} from "./get_moderation_items";

const queue = require('../../workers/queue');
const models = require("../../../models");
const i18n = require('../../utils/i18n');
const async = require('async');
const moment = require('moment');
const log = require('../../utils/logger');
const _ = require('lodash');
const getAnonymousUser = require('../../utils/get_anonymous_system_user');

const moderationItemActionMaster = (req, res, options) => {
  getAnonymousUser((error, anonymousUser) => {
    if (error) {
      log.error("Error in getAnonymousUser in moderationItemsActionMaster", {error});
      res.sendStatus(500)
    } else {
      options.model.find({
        where: {
          id: req.params.itemId
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
            res.sendStatus(200);
          }).catch( error => {
            log.error("Error deleting moderated item", { error });
            res.sendStatus(500);
          });
        }
      }).catch(error => {
        log.error("Error deleting moderated item", { error });
        res.sendStatus(500);
      })
    }
  });
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
      } else if (options.actionType==='clearFlags') {
        updateValues = {
          counter_flags: 0
        };
      }
      if (updateValues) {
        workPackage.model.updateAll(
          updateValues,
          {
            where: {
            id: {
              $in: workPackage.actionItemIds
            }
          },
          include: workPackage.includes
        }).then((spread) => {
          log.info('Moderation Action Many', { spread, options });
          callback();
        }).catch(error => {
          callback(error);
        })
      } else {
        callback("Couldn't find update values")
      }
    }
  });
};

const moderationItemActionDomain = (req, res, model, actionType) => {
  moderationItemActionMaster(req, res, { model, actionType, includes: domainIncludes(req.params.domainId) });
};

const moderationItemActionCommunity = (req, res, model, actionType) => {
  moderationItemActionMaster(req, res, { model, actionType, includes: communityIncludes(req.params.communityId) });
};

const moderationItemActionGroup = (req, res, model, actionType) => {
  moderationItemActionMaster(req, res, { model, actionType, includes: groupIncludes(req.params.groupId) });
};

const moderationItemActionUser = (req, res, model, actionType) => {
  if (actionType==='delete' || actionType==='anonymize') {
    moderationItemActionMaster(req, res, { model, actionType, includes: userIncludes(req.params.userId) });
  } else {
    log.error("Trying to call forbidden actions for user", { actionType });
    res.sendStatus(500);
  }
};

const performManyModerationActions = (workPackage, callback) => {
  const postItems = _.filter(workPackage.items, (item) => {
    return item.isPost
  });

  const postIds = _.map(postItems, item => {
    return item.id
  });

  const pointItems = _.filter(workPackage.items, (item) => {
    return item.isPoint
  });

  const pointIds = _.map(pointItems, item => {
    return item.id
  });

  let includes;

  if (workPackage.domainId) {
    includes = { includes: domainIncludes(workPackage.domainId) };
  } else if (workPackage.communityId) {
    includes = { includes: communityIncludes(workPackage.communityId) };
  } else if (workPackage.groupId) {
    includes = { includes: groupIncludes(workPackage.groupId) };
  } else if (workPackage.userId) {
    includes = { includes: userIncludes(workPackage.userId) };
  }  else {
    callback("Wrong action parameters", workPackage);
    return;
  }

  async.parallel([
    parallelCallback => {
      if (postIds && postIds.length>0) {
        moderationManyItemsActionMaster(_.merge(workPackage, { model: model.Post, includes, actionItemIds: postIds }), parallelCallback);
      } else {
        parallelCallback();
      }
    },
    parallelCallback => {
      if (pointIds && pointIds.length>0) {
        moderationManyItemsActionMaster(_.merge(workPackage, { model: model.Point, includes, actionItemIds: pointIds }), parallelCallback);
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
  moderationItemActionDomain,
  moderationItemActionCommunity,
  moderationItemActionGroup,
  moderationItemActionUser,
  performManyModerationActions
};