var express = require('express');
var router = express.Router();
var newsFeedFilter = ("../engine/newsfeed_filter");
var models = require("../../models");
var auth = require('../../authorization');
var log = require('../utils/logger');
var toJson = require('../utils/to_json');
var _ = require('lodash');

var moment = require('moment');

var getRecommendationFor = require('../engine/recommendations/events_manager').getRecommendationFor;
var airbrake = null;
if(process.env.AIRBRAKE_PROJECT_ID) {
  airbrake = require('airbrake').createClient(process.env.AIRBRAKE_PROJECT_ID, process.env.AIRBRAKE_API_KEY);
}

var OVERALL_LIMIT=7;

var DATE_OPTIONS = { name:"date", after: moment().add(-1000, 'months').toISOString() };
var DATE_OPTIONS_YEAR = { name:"date", after: moment().add(-3000, 'months').toISOString() };

var setupOptions = function (req) {
  var options = {
    user_id: req.user ? req.user.id : -1
  };

  return options;
};

var processRecommendations = function (levelType, req, res, recommendedItemIds, error) {
  var finalIds;

  if (error) {
    finalIds = [];
    log.error("Recommendation Error "+levelType, { err: error, id: req.params.id, userId:  req.user ? req.user.id : -1, errorStatus:  500 });
    if(airbrake) {
      airbrake.notify(error, function(airbrakeErr, url) {
        if (airbrakeErr) {
          log.error("AirBrake Error", { context: 'airbrake', err: airbrakeErr, errorStatus: 500 });
        }
      });
    }
  } else {
    finalIds = _.shuffle(recommendedItemIds);
    if (finalIds.length>OVERALL_LIMIT) {
      finalIds = _.dropRight(finalIds, OVERALL_LIMIT);
    }
  }

  log.info("Recommendations domains status", { recommendedItemIds: recommendedItemIds });

  models.Post.findAll({
    where: {
      id: {
        $in: finalIds
      }
    },
    order: [
      [ { model: models.Image, as: 'PostHeaderImages' } ,'updated_at', 'asc' ]
    ],
    attributes: ['id','name','description','public_data','status','content_type','official_status','counter_endorsements_up','cover_media_type',
      'counter_endorsements_down','group_id','language','counter_points','counter_flags','location','created_at'],
    include: [
      {
        // Category
        model: models.Category,
        required: false,
        include: [
          {
            model: models.Image,
            required: false,
            as: 'CategoryIconImages'
          }
        ]
      },
      // Group
      {
        model: models.Group,
        required: true,
        where: {
          status: {
            $in: ['active','featured']
          },
          access: models.Group.ACCESS_PUBLIC
        },
        include: [
          {
            model: models.Category,
            required: false
          },
          {
            model: models.Community,
            attributes: ['id','name','theme_id'],
            required: false
          }
        ]
      },
      // User
      {
        model: models.User,
        required: false,
        attributes: models.User.defaultAttributesWithSocialMediaPublic
      },
      // Image
      {
        model: models.Image,
        required: false,
        as: 'PostHeaderImages'
      },
      // PointRevision
      {
        model: models.PostRevision,
        required: false
      }
    ]
  }).then(function(posts) {
    res.send(posts);
  }).catch(function(error) {
    log.error("Recommendation Error "+levelType, { err: error, id: req.params.id, userId:  req.user ? req.user.id : -1, errorStatus: 500 });
    if(airbrake) {
      airbrake.notify(error, function(airbrakeErr, url) {
        if (airbrakeErr) {
          log.error("AirBrake Error", { context: 'airbrake', err: airbrakeErr, errorStatus: 500 });
        }
        res.sendStatus(500);
      });
    } else {
      res.sendStatus(500);
    }
    res.sendStatus(200);
  });
};

var processRecommendationsLight = function (groupId, req, res, recommendedItemIds, error) {
  var finalIds;

  if (error) {
    finalIds = [];
    log.error("processRecommendationsLight Error", { err: error, userId:  req.user ? req.user.id : -1, errorStatus:  500 });
    if(airbrake) {
      airbrake.notify(error, function(airbrakeErr, url) {
        if (airbrakeErr) {
          log.error("AirBrake Error", { context: 'airbrake', err: airbrakeErr, errorStatus: 500 });
        }
      });
    }
  } else {
    finalIds = _.shuffle(recommendedItemIds);
    if (finalIds.length>OVERALL_LIMIT) {
      finalIds = _.dropRight(finalIds, OVERALL_LIMIT);
    }
  }

  log.info("processRecommendationsLight for group status", { recommendedItemIds: recommendedItemIds });

  models.Post.findAll({
    where: {
      id: {
        $in: finalIds
      }
    },
    attributes: ['id','name','description'],
    include: [
      {
        model: models.Group,
        required: true,
        where: {
          id: groupId
        }
      }
    ]
  }).then(function(posts) {
    res.send({recommendations: posts, groupId: groupId });
  }).catch(function(error) {
    log.error("processRecommendationsLight Error ", { err: error, userId:  req.user ? req.user.id : -1, errorStatus: 500 });
    if(airbrake) {
      airbrake.notify(error, function(airbrakeErr, url) {
        if (airbrakeErr) {
          log.error("AirBrake Error", { context: 'airbrake', err: airbrakeErr, errorStatus: 500 });
        }
        res.sendStatus(500);
      });
    } else {
      res.sendStatus(500);
    }
    res.sendStatus(200);
  });
};

router.get('/domains/:id', auth.can('view domain'), function(req, res) {
  var options = setupOptions(req);

  options = _.merge(options, {
    domain_id: req.params.id,
    limit: OVERALL_LIMIT*2
  });

  getRecommendationFor(options.user_id, DATE_OPTIONS, options, function (error, recommendedItemIds) {
    processRecommendations("domain", req, res, recommendedItemIds, error);
  }, req.user ? req.user.default_locale : null);
});

router.get('/communities/:id', auth.can('view community'),  function(req, res) {
  var options = setupOptions(req);

  options = _.merge(options, {
    community_id: req.params.id,
    limit: OVERALL_LIMIT*2
  }, req.user ? req.user.default_locale : null);

  getRecommendationFor(options.user_id, DATE_OPTIONS, options, function (error, recommendedItemIds) {
    processRecommendations("community", req, res, recommendedItemIds, error);
  }, req.user ? req.user.default_locale : null);
});

router.get('/groups/:id', auth.can('view group'), function(req, res) {
  var options = setupOptions(req);

  options = _.merge(options, {
    group_id: req.params.id,
    limit: OVERALL_LIMIT*2
  });

  getRecommendationFor(options.user_id, DATE_OPTIONS, options, function (error, recommendedItemIds) {
    processRecommendations("group", req, res, recommendedItemIds, error);
  }, req.user ? req.user.default_locale : null);
});

router.put('/groups/:id/getPostRecommendations', auth.can('view group'), function(req, res) {
  var options = setupOptions(req);

  options = _.merge(options, {
    group_id: req.params.id,
    limit: 100
  });

  getRecommendationFor(options.user_id, DATE_OPTIONS_YEAR, options, function (error, recommendedItemIds) {
    if (!error) {
      processRecommendationsLight(req.params.id, req, res, recommendedItemIds, error);
    } else {
      log.error("Error from getRecommendationFor", { error });
      res.send({recommendations: [], groupId: req.params.id });
    }
  }, req.user ? req.user.default_locale : null);
});

module.exports = router;