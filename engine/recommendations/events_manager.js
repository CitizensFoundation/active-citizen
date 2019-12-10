const predictionio = require('predictionio-driver');
const models = require('../../../models');
const _ = require('lodash');
const async = require('async');
const log = require('../../utils/logger');

let engine = null;
let airbrake = null;

if(process.env.AIRBRAKE_PROJECT_ID) {
  airbrake = require('../../utils/airbrake');
}

const ACTIVE_CITIZEN_PIO_APP_ID = 1;

if (process.env.PIOEngineUrl) {
  engine = new predictionio.Engine({url: process.env.PIOEngineUrl });
}

const getClient = (appId) => {
  return new predictionio.Events({appId: appId});
};

const convertToString = (integer) => {
  return integer.toString();
};

const getPost = (postId, callback) => {
  models.Post.find(
    {
      where: {
        id: postId,
        status: 'published'
      },
      include: [
        {
          model: models.Category,
          required: false
        },
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
                  required: true
                }
              ]
            }
          ]
        }
      ]
    }).then((post) => {
    if (post) {
      callback(post)
    } else {
      callback(null);
    }
  }).catch((error) => {
    log.error('Events Manager getPost Error', {postId: postId, err: "Could not find post" });
    callback(null);
  });
};

const createOrUpdateItem = (postId, date, callback) => {
  const client = getClient(ACTIVE_CITIZEN_PIO_APP_ID);
  getPost(postId, (post) => {
    if (post) {
      let properties = {};

      if (post.category_id) {
        properties = _.merge(properties,
          {
            category: [ convertToString(post.category_id) ]
          });
      }
      properties = _.merge(properties,
        {
          domain: [ convertToString(post.Group.Community.Domain.id) ],
          domainLocale: [ post.Group.Community.Domain.default_locale ],

          community: [ convertToString(post.Group.Community.id) ],
          communityAccess: [ convertToString(post.Group.Community.access) ],
          communityStatus: [ post.Group.Community.status ],
          communityLocale: [ (post.Group.Community.default_locale && post.Group.Community.default_locale!=='')  ?
            post.Group.Community.default_locale :
            post.Group.Community.Domain.default_locale ],

          group: [ convertToString(post.Group.id) ],
          groupAccess: [ convertToString(post.Group.access) ],
          groupStatus: [ convertToString(post.Group.status) ],

          status: [ post.deleted ? 'deleted' : post.status ],

          official_status: [ convertToString(post.official_status) ],
          language: [ (post.language && post.language!=='') ? post.language : "??" ]
        });

      properties = _.merge(properties,
        {
          date: date,
          createdAt: post.created_at.toISOString()
        }
      );

      client.createItem({
        entityId: post.id,
        properties: properties,
        date: date,
        eventTime: new Date().toISOString()
      }).then((result) => {
        log.info('Events Manager createOrUpdateItem', {postId: post.id, result: result});
        callback();
      });
    } else {
      log.error('Events Manager createOrUpdateItem error could not find post', {postId: postId, err: "Could not find post" });
      callback();
    }
  })
};

const createAction = (targetEntityId, userId, date, action, callback) => {
  const client = getClient(ACTIVE_CITIZEN_PIO_APP_ID);

  getPost(targetEntityId, (post) => {
    if (post) {
      client.createAction({
        event: action,
        uid: userId,
        targetEntityId: targetEntityId,
        date: date,
        eventTime: date
      }).then((result) => {
        log.info('Events Manager createAction', {action: action, postId: targetEntityId, userId: userId, result: result});
        callback();
        //createOrUpdateItem(targetEntityId, date, callback);
      }).catch((error) => {
        log.error('Events Manager createAction Error', {action: action, postId: targetEntityId, userId: userId, err: error});
        callback(error);
      });
    } else {
      log.error('Events Manager createAction Error', { action: action, postId: targetEntityId, userId: userId, err: "Could not find post" });
      callback();
    }
  });
};

const createUser = (user, callback) => {
  client = getClient(ACTIVE_CITIZEN_PIO_APP_ID);
  client.createUser( {
    appId: 1,
    uid: user.id,
    eventDate: user.created_at.toISOString()
  }).then((result) => {
    log.info('Events Manager createUser', { userId: user.id, result: result});
    callback();
  }).catch((error) => {
    log.error('Events Manager createUser Error', { userId: user.id, err: error});
    callback(error);
  });
};

const generateRecommendationEvent = (activity, callback) => {
  if (process.env.PIOEventUrl && activity) {
    log.info('Events Manager generateRecommendationEvent', {type: activity.type, userId: activity.user_id });
    switch (activity.type) {
      case "activity.post.new":
      case "activity.post.copied":
        createOrUpdateItem(activity.Post.id, activity.Post.created_at.toISOString(), callback);
        break;
      case "activity.post.endorsement.new":
      case "activity.post.endorsement.copied":
      case "activity.post.rating.new":
      case "activity.post.rating.copied":
        createAction(activity.Post.id, activity.user_id, activity.created_at.toISOString(), 'endorse', callback);
        break;
      case "activity.post.opposition.new":
        createAction(activity.Post.id, activity.user_id, activity.created_at.toISOString(), 'oppose', callback);
        break;
      case "activity.point.new":
      case "activity.point.copied":
        if (activity.Point) {
          if (activity.Point.value==0 && activity.Point.Post) {
            createAction(activity.Point.Post.id, activity.user_id, activity.created_at.toISOString(), 'point-comment-new', callback);
          } else if (activity.Point.Post) {
            createAction(activity.Point.Post.id, activity.user_id, activity.created_at.toISOString(), 'point-new', callback);
          } else {
            callback();
          }
        } else {
          callback();
        }
        break;
      case "activity.point.helpful.new":
      case "activity.point.helpful.copied":
        if (activity.Point.Post) {
          createAction(activity.Point.Post.id, activity.user_id, activity.created_at.toISOString(), 'point-helpful', callback);
        } else {
          callback();
        }
        break;
      case "activity.point.unhelpful.new":
      case "activity.point.unhelpful.copied":
        if (activity.Point.Post) {
          createAction(activity.Point.Post.id, activity.user_id, activity.created_at.toISOString(), 'point-unhelpful', callback);
        } else {
          callback();
        }
        break;
      case "activity.post.status.change":
        if (activity && activity.Post) {
          createOrUpdateItem(activity.Post.id, activity.Post.created_at.toISOString(), callback);
        } else {
          callback();
        }
      default:
        callback();
    }
  } else {
    log.warn("No PIOEventUrl or no activity, no action taken in generateRecommendationEvent", { activityType: activity ? activity.type : null });
    callback();
  }
};

const getRecommendationFor = (userId, dateRange, options, callback, userLocale) => {
  const fields = [];

  fields.push({
    name: 'status',
    values: ['published'],
    bias: -1
  });

  if (options.domain_id) {
    fields.push({
      name: 'domain',
      values: [ options.domain_id ],
      bias: -1
    });
  }

  if (options.community_id) {
    fields.push({
      name: 'community',
      values: [ options.community_id ],
      bias: -1
    });
  }

  if (options.group_id) {
    fields.push({
      name: 'group',
      values: [ options.group_id ],
      bias: -1
    });
  }

  const officialStatus = options.official_status ? options.official_status : 0;

  fields.push({
    name: 'official_status',
    values: [ officialStatus.toString() ],
    bias: -1
  });

  if (!options.group_id && !options.community_id) {
    fields.push({
      name: 'groupStatus',
      values: [ "active", "featured"],
      bias: -1
    });
    fields.push({
      name: 'communityStatus',
      values: [ "active", "featured"],
      bias: -1
    });
    if (userLocale) {
      fields.push({
        name: 'communityLocale',
        values: [ userLocale ],
        bias: 0.9 // High boost for the selected user locale
      });
    }
  } else if (!options.group_id) {
    fields.push({
      name: 'groupStatus',
      values: [ "active","featured"],
      bias: -1
    });
    if (userLocale) {
      fields.push({
        name: 'communityLocale',
        values: [ userLocale ],
        bias: 0.9 // High boost for the selected user locale
      });
    }
  }
  
  log.info('Events Manager getRecommendationFor', { fields: fields, dateRange: dateRange });

  if (engine) {
    engine.sendQuery({
      user: userId,
      num: options.limit || 400,
      fields: fields,
      dateRange: dateRange
    }).then((results) => {
      if (results) {
        log.info('Events Manager getRecommendationFor', { userId: userId });
        const resultMap =  _.map(results.itemScores, (item) => { return item.item; });
        callback(null,resultMap);
      } else {
        callback("Not results for recommendations");
      }
    }).catch((error) => {
      callback(error);
    });
  } else {
    log.warn("Pio engine not available getRecommendationFor");
    callback();
  }
};

const isItemRecommended = (itemId, userId, dateRange, options, callback) => {
  getRecommendationFor(userId, dateRange, options,  (error, items) => {
    if (error) {
      log.error("Recommendation Events Manager Error", { itemId: itemId, userId: userId, err: error });
      if(airbrake) {
        airbrake.notify(error).then((airbrakeErr)=> {
          if (airbrakeErr.error) {
            log.error("AirBrake Error", { context: 'airbrake', err: airbrakeErr.error, errorStatus: 500 });
          }
        });
      }
      callback(_.includes([], itemId.toString()));
    } else {
      log.info('Events Manager isItemRecommended', { itemId: itemId, userId: userId });
      callback(_.includes(items, itemId.toString()));
    }
  });
};

module.exports = {
  generateRecommendationEvent: generateRecommendationEvent,
  getRecommendationFor: getRecommendationFor,
  isItemRecommended: isItemRecommended
};