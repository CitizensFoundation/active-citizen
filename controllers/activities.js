var express = require('express');
var router = express.Router();
var models = require("../../models");
var auth = require('../../authorization');
var log = require('../utils/logger');
var toJson = require('../utils/to_json');
var _ = require('lodash');

var getCommonWhereOptions = require('../engine/news_feeds/news_feeds_utils').getCommonWhereOptions;
var defaultKeyActivities = require('../engine/news_feeds/news_feeds_utils').defaultKeyActivities;
var activitiesDefaultIncludes = require('../engine/news_feeds/news_feeds_utils').activitiesDefaultIncludes;

var getActivities = function (req, res, options, callback) {
  options = _.merge(options, {
    dateColumn: 'created_at'
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

  var where = _.merge(getCommonWhereOptions(options), { type: { $in: defaultKeyActivities }});

  if (options.noBulkOperations) {
    where =_.merge(where, {
      //TODO: Fix should exclude bulkOperation
      sub_type: null
    })
  }

  models.AcActivity.findAll({
    where: where,
    order: [
      ["created_at", "desc"],
      [ models.User, { model: models.Image, as: 'UserProfileImages' }, 'created_at', 'asc' ],
      [ models.Post, { model: models.Image, as: 'PostHeaderImages' }, 'created_at', 'asc' ],
      [ models.Group, { model: models.Image, as: 'GroupLogoImages' }, 'created_at', 'asc' ],
      [ models.User, { model: models.Organization, as: 'OrganizationUsers' }, { model: models.Image, as: 'OrganizationLogoImages' }, 'created_at', 'asc' ]
    ],
      include: activitiesDefaultIncludes(options),
      limit: 20
  }).then(function(activities) {
    var slicedActivitesBecauseOfLimitBug = _.take(activities, 20);
    res.send({
      activities: slicedActivitesBecauseOfLimitBug,
      oldestProcessedActivityAt: slicedActivitesBecauseOfLimitBug.length>0 ? _.last(slicedActivitesBecauseOfLimitBug).created_at : null
    });
    callback();
  }).catch(function(error) {
    callback(error);
  });
};

router.get('/domains/:id', auth.can('view domain'), function(req, res) {
  var options = {
    domain_id: req.params.id,
    noBulkOperations: true
  };
  getActivities(req, res, options, function (error) {
    if (error) {
      log.error("Activities Error Domain", { domainId: req.params.id, userId: req.user ? req.user.id : null, errorStatus:  500 });
      res.sendStatus(500);
    }
  });
});

router.get('/communities/:id', auth.can('view community'), function(req, res) {
  var options = {
    community_id: req.params.id,
    noBulkOperations: true
  };
  getActivities(req, res, options, function (error) {
    if (error) {
      log.error("Activities Error Community", { communityId: req.params.id, userId: req.user ? req.user.id : null, errorStatus:  500 });
      res.sendStatus(500);
    }
  });
});

router.get('/groups/:id', auth.can('view group'), function(req, res) {
  var options = {
    group_id: req.params.id
  };
  getActivities(req, res, options, function (error) {
    if (error) {
      log.error("Activities Error Group", { groupId: req.params.id, userId: req.user ? req.user.id : null, errorStatus:  500 });
      res.sendStatus(500);
    }
  });
});

router.get('/posts/:id', auth.can('view post'), function(req, res) {
  var options = {
    post_id: req.params.id
  };
  getActivities(req, res, options, function (error) {
    if (error) {
      log.error("Activities Error Group", { postId: req.params.id, userId: req.user ? req.user.id : null, errorStatus:  500 });
      res.sendStatus(500);
    }
  });
});

module.exports = router;