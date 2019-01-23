var predictionio = require('predictionio-driver');
var models = require('../../../models');
var _ = require('lodash');
var async = require('async');
var log = require('../../../utils/logger');

var ACTIVE_CITIZEN_PIO_APP_ID = 1;

let postUpdateAsyncLimit = 42;

var getClient = function (appId) {
  return new predictionio.Events({appId: appId});
};

var lineCrCounter = 0;

var convertToString = function(integer) {
  return integer.toString();
};

var processDots = function() {
  if (lineCrCounter>250) {
    process.stdout.write("\n");
    lineCrCounter = 1;
  } else {
    process.stdout.write(".");
    lineCrCounter += 1;
  }
};

var importAllUsers = function (done) {
  var client = getClient(1);

  log.info('AcImportAllUsers', {});
  lineCrCounter = 0;
  models.User.findAll(
    {
      attributes: ['id','notifications_settings','email','name','created_at']
    }).then(function (users) {
    async.eachSeries(users, function (user, callback) {
      client.createUser( {
        appId: 1,
        uid: user.id,
        eventTime: user.created_at.toISOString()
      }).then(function(result) {
        processDots();
        //console.log(result);
        callback();
      }).catch(function(error) {
        console.error(error);
        callback();
      });
    }, function () {
      console.log("\n FIN");
      done();
    });
  });
};


var importFollowings = function (done) {
  var client = getClient(ACTIVE_CITIZEN_PIO_APP_ID);

  log.info('AcImportFollowings', {});
  lineCrCounter = 0;
  models.AcFollowing.findAll({
  }).then(function (followings) {
    async.eachSeries(followings, function (following, callback) {
      client.createAction({
        event: 'user-following',
        entityId: following.user_id,
        targetEntityId: following.other_user_id,
        targetEntityType: 'user',
        date: following.created_at.toISOString(),
        eventTime: following.created_at.toISOString()
      }).then(function(result) {
        processDots();
        callback();
      }).catch(function(error) {
        console.error(error);
        callback();
      });
    }, function () {
      console.log("\n FIN");
      done();
    });
  });
};

var updateAllPosts = function (done) {
  var client = getClient(ACTIVE_CITIZEN_PIO_APP_ID);
  log.info('AcImportAllPosts', {});

  models.Post.findAll(
    {
      include: [
        {
          model: models.Point,
          required: false,
          where: {
            status: 'published'
          }
        },
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
    }).then(function (posts) {
    lineCrCounter = 0;
    async.eachOfLimit(posts, postUpdateAsyncLimit,function (post, index, callback) {

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
          date: post.created_at.toISOString()
        }
      );

      client.createItem({
        entityId: post.id,
        properties: properties,
        date: post.created_at.toISOString(),
        eventTime: post.created_at.toISOString()
      }).then(function(result) {
        //  console.log(result);
        if (post.category_id && !post.deleted) {
          client.createAction({
            event: 'category-preference',
            entityId: post.user_id,
            targetEntityId :post.category_id,
            date: post.created_at.toISOString(),
            eventTime: post.created_at.toISOString()
          }).then(function(result) {
            processDots();
            callback();
          });
        } else {
          processDots();
          callback();
        }
      }).catch(function(error) {
        console.error(error);
        callback();
      });
    }, function () {
      console.log("Finished updating posts");
      done();
    });
  });
};

var importAllActionsFor = function (model, where, include, action, done, attributes) {
  var client = getClient(ACTIVE_CITIZEN_PIO_APP_ID);
  log.info('AcImportAllActionsFor', {action:action, model: model, where: where, include: include});

  model.findAll(
    {
      where: where,
      include: include,
      attributes: attributes
    }
  ).then(function (objects) {
    lineCrCounter = 0;
    async.eachOfLimit(objects, 42, (object, index, callback) => {
      var targetEntityId;
      if (action.indexOf('help') > -1) {
        targetEntityId = object.Point.Post.id;
      } else if (action.indexOf('post') > -1) {
        targetEntityId = object.id;
      } else {
        targetEntityId = object.Post.id;
      }

      if (targetEntityId) {
        client.createAction({
          event: action,
          uid: object.user_id,
          targetEntityId: targetEntityId,
          date: object.created_at.toISOString(),
          eventTime: object.created_at.toISOString()
        }).then(function(result) {
          processDots();
          //       console.log(result);
          callback();
        }).
        catch(function(error) {
          console.error(error);
          callback();
        });
      } else {
        console.error("Can't find id for object: " + object);
        callback();
      }
    }, function (error) {
      console.log(error);
      console.log("\n FIN");
      done();
    });
  });
};

var importAll = function(done) {
  async.series([
    function(callback){
      importAllActionsFor(models.Post, {}, [], 'new-post', function () {
        callback();
      });
    },
    function(callback){
      importAllActionsFor(models.Endorsement, { value: { $gt: 0 } }, [ { model: models.Post, attributes: ['id'] }  ], 'endorse', function () {
        callback();
      }, ['id','user_id','created_at','value']);
    },
    function(callback){
      importAllActionsFor(models.Endorsement, { value: { $lt: 0 } }, [  { model: models.Post, attributes: ['id'] } ], 'oppose', function () {
        callback();
      }, ['id','user_id','created_at','value']);
    },
    function(callback){
      importAllActionsFor(models.Point, { value: { $ne: 0 }}, [ { model: models.Post, attributes: ['id'] } ], 'new-point', function () {
        callback();
      }, ['id','user_id','created_at','value']);
    },
    function(callback){
      importAllActionsFor(models.Point, { value: 0 },  [{ model: models.Post, attributes: ['id'] } ], 'new-point-comment', function () {
        callback();
      }, ['id','user_id','created_at','value']);
    },
    function(callback){
      importAllActionsFor(models.PointQuality, { value: { $gt: 0 } }, [{
          model: models.Point,
          attributes: ['id','value'],
          include: [{ model: models.Post, attributes: ['id'] } ]
        }], 'point-helpful', function () {
        callback();
      }, ['id','user_id','created_at','value']);
    },
    function(callback){
      importAllActionsFor(models.PointQuality, { value: { $lt: 0 } }, [{
        model: models.Point,
        attributes: ['id','value'],
        include: [ models.Post ]
      }], 'point-unhelpful', function () {
        callback();
      }, ['id','user_id','created_at','value']);
    },
    function(callback){
      updateAllPosts(function () {
        callback();
      });
    }
  ], function () {
    console.log("FIN");
    done();
  });
};

getClient(ACTIVE_CITIZEN_PIO_APP_ID).status().then(function(status) {
  console.log("status");
  console.log(status);
  log.info('AcImportStarting', {});
  if (process.argv[2] && process.argv[2]=="onlyUpdatePosts") {
    postUpdateAsyncLimit = 1;
    updateAllPosts(function () {
      console.log("Done updating posts");
      process.exit();
    });
  } else {
    importAll(function () {
      console.log("Done importing all");
      process.exit();
    });
  }
}).catch(function (error) {
  console.log("error");
  console.log(error);
});
