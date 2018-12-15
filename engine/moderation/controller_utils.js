var queue = require('../../workers/queue');
var models = require("../../../models");
var i18n = require('../../utils/i18n');
var async = require('async');
var log = require('../../utils/logger');
var _ = require('lodash');
var toJson = require('../../utils/to_json');

const moderationItemsActionMaster = (req, res, options) => {
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
        item.counter_flags = 0;
      } else if (options.actionType==='clearFlags') {
        item.counter_flags = 0;
      }
      item.save().then( () => {
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
};

const domainIncludes = (domainId) => {
  return [
    {
      model: models.Group,
      required: true,
      include: [
        {
          model: models.Community,
          required: true,
          include: [
            {
              model: models.Domain,
              where: {
                id: domainId
              },
              required: true
            }
          ]
        }
      ]
    }
  ];
};

const communityIncludes = (communityId) => {
  return [
    {
      model: models.Group,
      required: true,
      include: [
        {
          model: models.Community,
          required: true,
          where: {
            id: communityId
          }
        }
      ]
    }
  ];
};

const groupIncludes = (groupId) => {
  return [
    {
      model: models.Group,
      required: true,
      where: {
        id: groupId
      }
    }
  ];
};

const moderationItemsActionDomain = (req, res, model, actionType) => {
  moderationItemsActionMaster(req, res, { model, actionType, includes: domainIncludes(req.params.domainId) });
};

const moderationItemsActionCommunity = (req, res, model, actionType) => {
  moderationItemsActionMaster(req, res, { model, actionType, includes: communityIncludes(req.params.communityId) });
};

const moderationItemsActionGroup = (req, res, model, actionType) => {
  moderationItemsActionMaster(req, res, { model, actionType, includes: groupIncludes(req.params.groupId) });
};

const getPushItem = (type, model) => {
  let lastReportedBy, toxicityScore = null;

  if (model.data && model.data.moderation) {
    const moderation = model.data.moderation;

    if (moderation.reporters && moderation.reporters.length>0) {
      lastReportedBy =  moderation.reporters[moderation.reporters.length-1];
    }

    if (moderation.toxicityScore) {
      toxicityScore = moderation.toxicityScore;
    }
  }

  return {
    id: model.id,
    created_at: model.created_at,
    modelType: type,
    counter_flags: model.counter_flags,
    status: model.status,
    user_id: model.user_id,
    last_reported_by: lastReportedBy,
    toxicity_score: toxicityScore
  };
};

const getItems = (posts, points) => {
  let items = [];
  _.forEach(posts, post => {
    items.push(getPushItem('post', post));
  });
  _.forEach(points, point => {
    items.push(getPushItem('point', point));
  });
  items = _.orderBy(items, item => {
    return item.created_at
  });
  return items;
};

const getModelModeration = (options, callback) => {
  options.model.unscoped().findAll({
    where: {
      deleted: false,
      $or: [
        {
          counter_flags: {
            $gt: 0
          },
        },
        {
          status: "in_moderation"
        }
      ],
    }
  }).then(posts => {
    callback(null, posts);
  }).catch(error => {
    callback(error);
  })
};

const getAllModeratedItemsByMaster = (includes, callback) => {
  let posts, points;

  async.parallel([
    parallelCallback => {
      getModelModeration({model: models.Post, includes: domainIncludes(domainId) }, (error, postsIn) => {
        if (error) {
          parallelCallback(error);
        } else {
          posts = postsIn;
        }
      })
    },
    parallelCallback => {
      getModelModeration({model: models.Point, includes: domainIncludes(domainId) }, (error, pointsIn) => {
        if (error) {
          parallelCallback(error);
        } else {
          points = pointsIn;
        }
      })
    }
  ], error => {
    callback(error, getItems(posts, points));
  });
};

const getAllModeratedItemsByDomain = (domainId, callback) => {
  getAllModeratedItemsByMaster(domainIncludes(domainId), callback);
};

const getAllModeratedItemsByCommunity = (communityId, callback) => {
  getAllModeratedItemsByMaster(communityIncludes(communityId), callback);
};

const getAllModeratedItemsByGroup = (groupId, callback) => {
  getAllModeratedItemsByMaster(groupIncludes(groupId), callback);
};

module.exports = {
  moderationItemsActionDomain,
  moderationItemsActionCommunity,
  moderationItemsActionGroup,
  getAllModeratedItemsByDomain,
  getAllModeratedItemsByCommunity,
  getAllModeratedItemsByGroup
};