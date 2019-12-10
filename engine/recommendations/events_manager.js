var predictionio = require('predictionio-driver');
var models = require('../../../models');
var _ = require('lodash');
var async = require('async');
var log = require('../../utils/logger');
var engine;

var airbrake = null;
if(process.env.AIRBRAKE_PROJECT_ID) {
  airbrake = require('../../utils/airbrake');
}

var ACTIVE_CITIZEN_PIO_APP_ID = 1;

if (process.env.PIOEngineUrl) {
  engine = new predictionio.Engine({url: process.env.PIOEngineUrl });
}

var getClient = function (appId) {
  return new predictionio.Events({appId: appId});
};

var convertToString = function(integer) {
  return integer.toString();
};

var getPost = function (postId, callback) {
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
    }).then(function (post) {
    if (post) {
      callback(post)
    } else {
      callback(null);
    }
  }).catch(function (error) {
    log.error('Events Manager getPost Error', {postId: postId, err: "Could not find post" });
    callback(null);
  });
};

var createOrUpdateItem = function (postId, date, callback) {
  var client = getClient(ACTIVE_CITIZEN_PIO_APP_ID);
  getPost(postId, function (post) {
    if (post) {
      var properties = {};

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
          communityLocale: [ (post.Group.Community.default_locale && post.Group.Community.default_locale!='')  ?
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
      }).then(function (result) {
        log.info('Events Manager createOrUpdateItem', {postId: post.id, result: result});
        callback();
      });
    } else {
      log.error('Events Manager createOrUpdateItem error could not find post', {postId: postId, err: "Could not find post" });
      callback();
    }
  })
};

var createAction = function (targetEntityId, userId, date, action, callback) {
  var client = getClient(ACTIVE_CITIZEN_PIO_APP_ID);

  getPost(targetEntityId, function (post) {
    if (post) {
      client.createAction({
        event: action,
        uid: userId,
        targetEntityId: targetEntityId,
        date: date,
        eventTime: date
      }).then(function (result) {
        log.info('Events Manager createAction', {action: action, postId: targetEntityId, userId: userId, result: result});
        callback();
        //createOrUpdateItem(targetEntityId, date, callback);
      }).catch(function (error) {
        log.error('Events Manager createAction Error', {action: action, postId: targetEntityId, userId: userId, err: error});
        callback(error);
      });
    } else {
      log.error('Events Manager createAction Error', { action: action, postId: targetEntityId, userId: userId, err: "Could not find post" });
      callback();
    }
  });
};

var createUser = function (user, callback) {
  client = getClient(ACTIVE_CITIZEN_PIO_APP_ID);
  client.createUser( {
    appId: 1,
    uid: user.id,
    eventDate: user.created_at.toISOString()
  }).then(function(result) {
    log.info('Events Manager createUser', { userId: user.id, result: result});
    callback();
  }).catch(function(error) {
    log.error('Events Manager createUser Error', { userId: user.id, err: error});
    callback(error);
  });
};

var generateRecommendationEvent = function (activity, callback) {
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
    log.warn("No PIOEventUrl or no activity, no action taken in generateRecommendationEvent", { activity });
    callback();
  }
};

var getRecommendationFor = function (userId, dateRange, options, callback, userLocale) {
  var fields = [];

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

  var officialStatus = options.official_status ? options.official_status : 0;

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
    }).then(function (results) {
      if (results) {
        log.info('Events Manager getRecommendationFor', { userId: userId });
        var resultMap =  _.map(results.itemScores, function(item) { return item.item; });
        callback(null,resultMap);
      } else {
        callback("Not results for recommendations");
      }
    }).catch(function (error) {
      callback(error);
    });
  } else {
    log.warn("Pio engine not available getRecommendationFor");
    callback();
  }
};

isItemRecommended = function (itemId, userId, dateRange, options, callback) {
  getRecommendationFor(userId, dateRange, options, function (error, items) {
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