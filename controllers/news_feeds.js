var express = require('express');
var router = express.Router();
var newsFeedFilter = ("../engine/newsfeed_filter");
var models = require("../../models");
var auth = require('../authorization');
var log = require('../utils/logger');
var toJson = require('../utils/to_json');
var _ = require('lodash');

var getCuratedNewsItems = require('../engine/news_feeds/generate_dynamically').getCuratedNewsItems;

router.get('/domains/:id', auth.can('view domain'), auth.isLoggedIn, function(req, res) {

  var options = {
    user_id: req.user.id,
    domain_id: req.params.id
  };

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

  getCuratedNewsItems(options, function (error, activities, oldestProcessedActivityAt) {
    if (error) {
      log.error("News Feed Error Domain", { domainId: req.params.id, userId: req.user.id, errorStatus:  500 });
      res.sendStatus(500);
    } else {
      res.send({
        activities: activities,
        oldestProcessedActivityAt: oldestProcessedActivityAt
      });
    }
  });
});

router.get('/groups/:id', auth.can('view group'), auth.isLoggedIn, function(req, res) {

  var options = {
    user_id: req.user.id,
    group_id: req.params.id
  };

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

  getCuratedNewsItems(options, function (error, activities, oldestProcessedActivityAt) {
    if (error) {
      log.error("News Feed Error Domain", { groupId: req.params.id, userId: req.user.id, errorStatus:  500 });
      res.sendStatus(500);
    } else {
      res.send({
        activities: activities,
        oldestProcessedActivityAt: oldestProcessedActivityAt
      });
    }
  });
});

router.get('/communities/:id', auth.can('view community'), auth.isLoggedIn, function(req, res) {

  var options = {
    user_id: req.user.id,
    community_id: req.params.id
  };

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

  getCuratedNewsItems(options, function (error, activities, oldestProcessedActivityAt) {
    if (error) {
      log.error("News Feed Error Domain", { communityId: req.params.id, userId: req.user.id, errorStatus:  500 });
      res.sendStatus(500);
    } else {
      res.send({
        activities: activities,
        oldestProcessedActivityAt: oldestProcessedActivityAt
      });
    }
  });
});

module.exports = router;