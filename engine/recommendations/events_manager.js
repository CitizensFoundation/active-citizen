const predictionio = require('predictionio-driver');
const models = require('../../../models');
const _ = require('lodash');
const async = require('async');
const log = require('../../utils/logger');
const request = require('request');

let engine = null;
let airbrake = null;

if(process.env.AIRBRAKE_PROJECT_ID) {
  airbrake = require('../../utils/airbrake');
}

const createAction = (postId, userId, date, action, callback) => {
  var properties = {};

  const esId = `${postId}-${userId}-${action}`;

  properties = _.merge(properties,
    {
      postId,
      userId,
      date,
      action,
      esId
    });

  const options = {
    url: process.env["AC_ANALYTICS_BASE_URL"]+"addPostAction/"+process.env.AC_ANALYTICS_CLUSTER_ID,
    headers: {
      'X-API-KEY': process.env["AC_ANALYTICS_KEY"]
    },
    json: properties
  };

  request.post(options, (error) => {
    callback(error);
  });
};

const createManyActions = (posts, callback) => {
  const options = {
    url: process.env["AC_ANALYTICS_BASE_URL"]+"addManyPostActions/"+process.env.AC_ANALYTICS_CLUSTER_ID,
    headers: {
      'X-API-KEY': process.env["AC_ANALYTICS_KEY"]
    },
    json: { posts: posts }
  };

  request.post(options, (error) => {
    callback(error);
  });
};

const generateRecommendationEvent = (activity, callback) => {
  if (process.env["AC_ANALYTICS_BASE_URL"] && activity) {
    log.info('Events Manager generateRecommendationEvent', {type: activity.type, userId: activity.user_id });
    switch (activity.type) {
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
  
  //log.info('Events Manager getRecommendationFor', { fields: fields, dateRange: dateRange });

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
  generateRecommendationEvent,
  getRecommendationFor,
  isItemRecommended,
  createAction,
  createManyActions
};