const queue = require('../../workers/queue');
const models = require("../../../models");
const i18n = require('../../utils/i18n');
const async = require('async');
const moment = require('moment');
const log = require('../../utils/logger');
const _ = require('lodash');

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
      } else if (options.actionType==='block') {
        item.status = 'blocked';
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

const userIncludes = (userId) => {
  return [
    {
      model: models.User,
      required: true,
      where: {
        id: userId
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

const moderationItemsActionUser = (req, res, model, actionType) => {
  moderationItemsActionMaster(req, res, { model, actionType, includes: userIncludes(req.params.userId) });
};

const _toPercent = number => {
  if (number) {
    return Math.round(number*100)+'%';
  }
};

const getPushItem = (type, model) => {
  let source, toxicityScore, latestContent = null,
      severeToxicityScore,
      lastReportedAtDate = null, firstReportedDate = null;

  if (model.data && model.data.moderation) {
    const moderation = model.data.moderation;

    if (moderation.toxicityScore) {
      toxicityScore = _toPercent(moderation.toxicityScore);
    }

    if (moderation.severeToxicityScore) {
      severeToxicityScore = _toPercent(moderation.severeToxicityScore);
    }
    if (moderation.lastReportedBy &&
      moderation.lastReportedBy.length > 0) {
      source = moderation.lastReportedBy[0].source;
      firstReportedDate = moderation.lastReportedBy[moderation.lastReportedBy.length-1].date;
      lastReportedAtDate = moderation.lastReportedBy[0].date;

      if (moderation.lastReportedBy.length > 1) {
        const a =  moderation.lastReportedBy;
        const b = a;
      }
    }
  }

  if (!firstReportedDate)
    firstReportedDate = model.created_at;

  if (!lastReportedAtDate)
    lastReportedAtDate = model.created_at;

  if (type==='point') {
    latestContent = model.PointRevisions[model.PointRevisions.length-1].content;
  }

  return {
    id: model.id,
    created_at: model.created_at,
    formatted_date: moment(model.created_at).format("DD/MM/YY HH:mm"),
    type: type,
    counter_flags: model.counter_flags,
    status: model.status,
    user_id: model.user_id,
    toxicityScore: toxicityScore,
    severeToxicityScore: severeToxicityScore,
    source: source,
    lastReportedAtDate: lastReportedAtDate,
    firstReportedDate: firstReportedDate,
    lastReportedAtDateFormatted: lastReportedAtDate ? moment(lastReportedAtDate).format("DD/MM/YY HH:mm") : null,
    firstReportedDateFormatted:  firstReportedDate ? moment(firstReportedDate).format("DD/MM/YY HH:mm") : null,
    user_email: model.User.email,
    cover_media_type: model.cover_media_type,
    is_post: type==='post',
    is_point: type==='point',
    title: model.name,
    post_id: model.post_id,
    Group: model.Group,
    language: model.language,
    name: model.name,
    description: model.description,
    moderation_data: { moderation: model.data ? model.data.moderation : null },
    content: type==='post' ? (model.name + ' ' + model.description) : model.content,
    PostVideos: model.PostVideos,
    PostAudios: model.PostAudios,
    PostHeaderImages: model.PostHeaderImages,
    PointVideos: model.PointVideos,
    PointAudios: model.PointAudios,
    PointRevisions: model.PointRevisions,
    latestContent: latestContent
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
  items = _.orderBy(items,['status', 'counter_flags', 'created_at'], ['asc','desc','asc']);
  return items;
};

const getModelModeration = (options, callback) => {
  options.model.unscoped().findAll({
    where: {
      deleted: false,
      $or: [
        {
          counter_flags: {
            $gt: options.allContent ? -1 : 0
          },
        },
        {
          status: "in_moderation_queue"
        }
      ],
    },
    order: options.order,
    include: options.includes
  }).then(items => {
    callback(null, items);
  }).catch(error => {
    callback(error);
  })
};

const getAllModeratedItemsByMaster = (options, callback) => {
  let posts, points;

  const postBaseIncludes = _.cloneDeep(options.includes);
  const pointBaseIncludes = _.cloneDeep(options.includes);

  async.series([
    parallelCallback => {
      let postIncludes = postBaseIncludes.concat([
        {
          model: models.Image,
          required: false,
          as: 'PostHeaderImages'
        },
        {
          model: models.Video,
          required: false,
          attributes: ['id','formats','updated_at','viewable','public_meta'],
          as: 'PostVideos',
          include: [
            {
              model: models.Image,
              as: 'VideoImages',
              attributes:["formats",'updated_at'],
              required: false
            },
          ]
        },
        {
          model: models.Audio,
          required: false,
          attributes: ['id','formats','updated_at','listenable'],
          as: 'PostAudios',
        }
      ]);

      if (!options.userId) {
        postIncludes = postIncludes.concat([ { model: models.User }]);
      } else {
        postIncludes = postIncludes.concat([ { model: models.Group }]);
      }

      const order = [
        [ { model: models.Image, as: 'PostHeaderImages' } ,'updated_at', 'asc' ],
        [ { model: models.Video, as: "PostVideos" }, 'updated_at', 'desc' ],
        [ { model: models.Audio, as: "PostAudios" }, 'updated_at', 'desc' ],
        [ { model: models.Video, as: "PostVideos" }, { model: models.Image, as: 'VideoImages' } ,'updated_at', 'asc' ]
      ];

      getModelModeration(_.merge(_.cloneDeep(options), {model: models.Post, includes: postIncludes, order }), (error, postsIn) => {
        parallelCallback(error);
        posts = postsIn;
      })
    },
    parallelCallback => {
      let pointIncludes = pointBaseIncludes.concat([
        {
          model: models.Video,
          required: false,
          attributes: ['id','formats','updated_at','viewable','public_meta'],
          as: 'PointVideos',
          include: [
            {
              model: models.Image,
              as: 'VideoImages',
              attributes:["formats",'updated_at'],
              required: false
            },
          ]
        },
        {
          model: models.Audio,
          required: false,
          attributes: ['id','formats','updated_at','listenable'],
          as: 'PointAudios'
        },
        {
          model: models.PointRevision,
          attributes: { exclude: ['ip_address', 'user_agent'] },
          required: false
        }
      ]);

      if (!options.userId) {
        pointIncludes = pointIncludes.concat([ { model: models.User }]);
      }

      const order = [
        [ { model: models.Video, as: "PointVideos" }, 'updated_at', 'desc' ],
        [ { model: models.Audio, as: "PointAudios" }, 'updated_at', 'desc' ],
        [ models.PointRevision, 'created_at', 'asc' ],
        [ { model: models.Video, as: "PointVideos" }, { model: models.Image, as: 'VideoImages' } ,'updated_at', 'asc' ]
      ];

      getModelModeration(_.merge(_.cloneDeep(options), {model: models.Point, includes: pointIncludes, order }), (error, pointsIn) => {
        points = pointsIn;
        parallelCallback(error);
      })
    }
  ], error => {
    callback(error, getItems(posts, points));
  });
};

const getAllModeratedItemsByDomain = (options, callback) => {
  getAllModeratedItemsByMaster(_.merge(options, {includes: domainIncludes(options.domainId) }), callback);
};

const getAllModeratedItemsByCommunity = (options, callback) => {
  getAllModeratedItemsByMaster(_.merge(options, {includes: communityIncludes(options.communityId) }), callback);
};

const getAllModeratedItemsByGroup = (options, callback) => {
  getAllModeratedItemsByMaster(_.merge(options, {includes: groupIncludes(options.groupId) }), callback);
};

const getAllModeratedItemsByUser = (options, callback) => {
  getAllModeratedItemsByMaster(_.merge(options, {includes: userIncludes(options.userId) }), callback);
};

module.exports = {
  moderationItemsActionDomain,
  moderationItemsActionCommunity,
  moderationItemsActionGroup,
  getAllModeratedItemsByDomain,
  getAllModeratedItemsByUser,
  getAllModeratedItemsByCommunity,
  getAllModeratedItemsByGroup
};