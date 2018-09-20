// https://gist.github.com/mojodna/1251812
var async = require("async");
var models = require("../../models");
var log = require('../utils/logger');
var queue = require('./queue');
var i18n = require('../utils/i18n');
var toJson = require('../utils/to_json');

var airbrake = null;
if(process.env.AIRBRAKE_PROJECT_ID) {
  airbrake = require('../utils/airbrake');
}

var _ = require('lodash');

var DeletionAndAnonymizationWorker = function () {};

const deleteOnePost = (workPackage, callback) => {
  if (workPackage.post_id) {
    log.info('Post Deleted Got Start');
    models.Post.find({
      where: {id: workPackage.post_id }
    }).then(function (post) {
      log.info('Post Deleted Got Post');
      models.AcActivity.findAll({
        attributes: ['id','deleted'],
        where: {
          post_id: post.id
        }
      }).then(function (activities) {
        log.info('Post Deleted Got Activities');
        var activityIds = _.map(activities, function (activity) {
          return activity.id;
        });
        models.AcActivity.update(
          { deleted: true },
          { where: {
              id: {
                $in: activityIds
              }
            }}
        ).then(function (spread) {
          post.deleted = true;
          post.save().then(function () {
            log.info('Post Deleted Completed');
            post.updateAllExternalCounters(req, 'down', 'counter_posts', function () {
              log.info('Post Deleted Counters updates');
              models.Point.findAll({
                attributes: ['id','deleted'],
                where: {
                  post_id: postId
                }
              }).then(function (points) {
                var pointIds = _.map(points, function (point) {
                  return point.id;
                });
                models.Point.update(
                  { deleted: true },
                  { where: {
                      id: {
                        $in: pointIds
                      }
                    }}
                ).then(function () {
                  post.updateAllExternalCountersBy(req, 'down', 'counter_points', points.length, function () {
                    log.info('Post Deleted Point Counters updates');
                    callback();
                  });
                });
              });
            });
          });
        });
      });
    }).catch(function(error) {
      callback(error);
    });
  } else {
    callback("Can't find post id");
  }
};

DeletionAndAnonymizationWorker.prototype.process = function (workPackage, callback) {

  switch(workPackage.type) {
    case 'delete-one-post':
      deleteOnePost(workPackage, callback);
      break;
    case 'delete-one-point':
      deleteOnePoint(workPackage, callback);
      break;
    case 'delete-all-posts':
      deleteAllPostsAndPoints(workPackage, callback);
      break;
    case 'anonymize-all-posts-and-points':
      anonymizeAllPostsAndPoints(workPackage, callback);
      break;
    default:
      callback("Unknown type for workPacakge");
  }
};

module.exports = new BulkStatusUpdateWorker();
