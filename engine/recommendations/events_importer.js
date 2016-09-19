var predictionio = require('predictionio-driver');
var models = require('../../../models');
var _ = require('lodash');
var async = require('async');
var log = require('../../../utils/logger');

var getClient = function (appId) {
  return new predictionio.Events({appId: appId});
};

var lineCrCounter = 0;

var convertToString = function(integer) {
  return integer.toString();
};

var processDots = function() {
  if (lineCrCounter>242) {
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
  models.User.findAll({
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
  var client = getClient(1);

  log.info('AcImportFollowings', {});
  lineCrCounter = 0;
  models.AcFollowing.findAll().then(function (followings) {
    async.eachSeries(followings, function (following, callback) {
      client.createAction({
        event: 'user-following',
        entityId: following.user_id,
        targetEntityId: following.other_user_id,
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

var importAllPosts = function (done) {
  var client = getClient(1);
  log.info('AcImportAllPosts', {});

  models.Post.findAll(
    {
      where: {
        status: 'published'
      },
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
          where: {
            access: models.Group.ACCESS_PUBLIC
          },
          include: [
            {
              model: models.Community,
              required: true,
              where: {
                access: models.Community.ACCESS_PUBLIC
              },
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
    async.eachSeries(posts, function (post, callback) {

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
          community: [ convertToString(post.Group.Community.id) ],
          group: [ convertToString(post.Group.id) ],
          groupAccess: [ convertToString(post.Group.access) ],
          communityAccess: [ convertToString(post.Group.access) ],
          groupStatus: [ convertToString(post.Group.status) ],
          status: [ post.status ],
          official_status: [ convertToString(post.official_status) ]
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
        if (post.category_id) {
          client.createAction({
            event: 'category-preference',
            entityId: post.user_id,
            targetEntityId:post.category_id,
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
      console.log("\n FIN");
      done();
    });
  });
};

var importAllActionsFor = function (model, where, include, action, done) {
  var client = getClient(1);
  log.info('AcImportAllActionsFor', {action:action, model: model, where: where, include: include});

  model.findAll(
    {
      where: where,
      include: include
    }
  ).then(function (objects) {
    lineCrCounter = 0;
    async.eachSeries(objects, function (object, callback) {
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
      importAllUsers(function () {
        callback();
      });
    },
    function(callback){
      importAllPosts(function () {
        callback();
      });
    },
    function(callback){
      importFollowings(function () {
        callback();
      });
    },
    function(callback){
      importAllActionsFor(models.Endorsement, { value: { $gt: 0 } }, [ models.Post ], 'endorse', function () {
        callback();
      });
    },
    function(callback){
      importAllActionsFor(models.Endorsement, { value: { $lt: 0 } }, [ models.Post ], 'oppose', function () {
        callback();
      });
    },
    function(callback){
      importAllActionsFor(models.Post, {}, [], 'new-post', function () {
        callback();
      });
    },
    function(callback){
      importAllActionsFor(models.Point, { value: { $ne: 0 }}, [ models.Post ], 'new-point', function () {
        callback();
      });
    },
    function(callback){
      importAllActionsFor(models.Point, { value: 0 },  [ models.Post ], 'new-point-comment', function () {
        callback();
      });
    },
    function(callback){
      importAllActionsFor(models.PointQuality, { value: { $gt: 0 } }, [{
          model: models.Point,
          include: [ models.Post ]
        }], 'point-helpful', function () {
        callback();
      });
    },
    function(callback){
      importAllActionsFor(models.PointQuality, { value: { $lt: 0 } }, [{
        model: models.Point,
        include: [ models.Post ]
      }], 'point-unhelpful', function () {
        callback();
      });
    }
  ], function () {
    console.log("FIN");
    done();
  });
};

getClient(1).status().then(function(status) {
  console.log("status");
  console.log(status);
  log.info('AcImportStarting', {});
  importAll(function () {
    console.log("DONE!");
  });
}).catch(function (error) {
  console.log("error");
  console.log(error);
});
