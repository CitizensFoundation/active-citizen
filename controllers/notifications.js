var express = require('express');
var router = express.Router();
var models = require("../../models");
var auth = require('../../authorization');
var log = require('../utils/logger');
var toJson = require('../utils/to_json');
var _ = require('lodash');
var async = require('async');

var getCommonWhereDateOptions = require('../engine/news_feeds/news_feeds_utils').getCommonWhereDateOptions;

var getNotifications = function (req, res, options, callback) {
  options = _.merge(options, {
    dateColumn: 'updated_at'
  });

  if (req.query.afterDate) {
    options = _.merge(options, {
      afterDate: new Date(req.query.afterDate)
    })
  }

  if (req.query.beforeDate) {
    options = _.merge(options, {
      beforeDate: new Date(req.query.beforeDate)
    })
  }

  var where = _.merge({
    user_id: req.user.id
  }, getCommonWhereDateOptions(options));

  var activityWhereOptions;
  //TODO: Enabled this when limit bug is fixed in Sequelize or de normalize domain_id to notifications
  /*
  if (process.env.NODE_ENV == 'production') {
    activityWhereOptions = { domain_id: req.ypDomain.id }
  }
  */

  var notifications, unViewedCount;

  async.parallel([
    function (parallelCallback) {
      models.AcNotification.findAll({
        where: where,
        order: [
          ["updated_at", "desc"],
          [ { model: models.AcActivity, as: 'AcActivities'} ,'created_at', 'desc' ],
          [ { model: models.AcActivity, as: 'AcActivities'}, models.User, { model: models.Image, as: 'UserProfileImages' }, 'created_at', 'asc' ],
          [ { model: models.AcActivity, as: 'AcActivities'}, models.User, { model: models.Organization, as: 'OrganizationUsers' }, { model: models.Image, as: 'OrganizationLogoImages' }, 'created_at', 'asc' ]
        ],
        include: [
          {
            model: models.AcActivity,
            as: 'AcActivities',
            attributes: ['id','type','domain_id','object'],
            where: activityWhereOptions,
            required: true,
            include: [
              {
                model: models.Post,
                required: false,
                attributes: ['id','name','user_id']
              },
              { model: models.User,
                attributes: ["id", "name", "facebook_id", "twitter_id", "google_id", "github_id"],
                required: false,
                include: [
                  {
                    model: models.Image, as: 'UserProfileImages',
                    required: false
                  },
                  {
                    model: models.Organization,
                    as: 'OrganizationUsers',
                    required: false,
                    attributes: ['id', 'name'],
                    include: [
                      {
                        model: models.Image,
                        as: 'OrganizationLogoImages',
                        //TODO: Figure out why there are no formats attributes coming through here
                        attributes: ['id', 'formats'],
                        required: false
                      }
                    ]
                  }
                ]
              },
              {
                model: models.Community,
                required: false,
                attributes: ['id','name']
              },
              {
                model: models.Group,
                required: false,
                attributes: ['id','name']
              },
              {
                model: models.Point,
                required: false,
                attributes: ['id','value','content']
              }
            ]
          }
        ],
        limit: 20
      }).then(function(inNotifications) {
        notifications = inNotifications;
        parallelCallback();
      }).catch(function(error) {
        parallelCallback(error);
      });
    },
    function (parallelCallback) {
      models.AcNotification.count({
        where: {
          viewed: false,
          user_id: req.user.id
        }
      }).then(function (count) {
        unViewedCount = count;
        parallelCallback();
      }).catch(function (error) {
        parallelCallback(error);
      });
    }
  ], function (error) {
    if (error) {
      callback(error);
    } else {
      var slicedActivitesBecauseOfLimitBug = _.take(notifications, 20);
      res.send({
        notifications: slicedActivitesBecauseOfLimitBug,
        unViewedCount: unViewedCount,
        oldestProcessedNotificationAt: slicedActivitesBecauseOfLimitBug.length>0 ? _.last(slicedActivitesBecauseOfLimitBug).created_at : null
      });
    }
  });
};

router.get('/', auth.isLoggedInNoAnonymousCheck, function(req, res) {
  var options = {};
  getNotifications(req, res, options, function (error) {
    if (error) {
      log.error("Notifications Error", { userId: req.user ? req.user.id : null, errorStatus:  500, err: error });
      res.sendStatus(500);
    }
  });
});

router.put('/markAllViewed', auth.isLoggedInNoAnonymousCheck, function(req, res) {
  models.AcNotification.update({
    viewed: true
  }, {
    where: { user_id: req.user.id },
    silent: true
  }).spread(function(affectedCount, affectedRows) {
    log.info("Notifications Have Marked All As Viewed", { affectedCount: affectedCount, affectedRows: affectedRows, userId: req.user ? req.user.id : null });
    res.sendStatus(200);
  }).catch(function (error) {
    log.error("Notifications Have Marked All As Viewed Error", { userId: req.user ? req.user.id : null, err: error, errorStatus:  500 });
    res.sendStatus(500);
  });
});

router.put('/setIdsViewed', auth.isLoggedInNoAnonymousCheck, function(req, res) {
  var viewedIds = req.body.viewedIds;
  var unViewedCount;
  async.series([
    function (seriesCallback) {
      models.AcNotification.update({
        viewed: true
      },{
        where: {
          user_id: req.user.id,
          id: {
            $in: viewedIds
          }
        },
        silent: true
      }).spread(function(affectedCount, affectedRows) {
        log.info("Notifications Have Marked Ids As Viewed", { affectedCount: affectedCount, affectedRows: affectedRows, userId: req.user ? req.user.id : null });
        seriesCallback();
      }).catch(function (error) {
        seriesCallback(error);
      });
    },
    function (seriesCallback) {
      models.AcNotification.count({
        where: {
          viewed: false,
          user_id: req.user.id
        }
      }).then(function (count) {
        unViewedCount = count;
        seriesCallback();
      }).catch(function (error) {
        seriesCallback(error);
      });
    }
  ], function (error) {
    if (error) {
      log.error("Notifications Have Marked Ids As Viewed Error", { userId: req.user ? req.user.id : null, err: error, errorStatus:  500 });
      res.sendStatus(500);
    } else {
      res.send({
        viewedIds: viewedIds,
        unViewedCount: unViewedCount
      });
    }
  });
});

module.exports = router;