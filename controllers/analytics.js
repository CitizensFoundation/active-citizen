const express = require('express');
const router = express.Router();
const models = require("../../models");
const auth = require('../../authorization');
const log = require('../utils/logger');
const toJson = require('../utils/to_json');
const moment = require('moment');
const _ = require('lodash');

const getPointDomainIncludes = (id) => {
  return [
    {
      model: models.Post,
      required: true,
      attributes: [],
      include: getDomainIncludes(id)
    }
  ]
};

const getDomainIncludes = (id) => {
  return [
    {
      model: models.Group,
      required: true,
      attributes: [],
      include: [
        {
          model: models.Community,
          required: true,
          attributes: [],
          include: [
            {
              model: models.Domain,
              where: { id: id },
              required: true,
              attributes: []
            }
          ]
        }
      ]
    }
  ]
};

const getPointCommunityIncludes = (id) => {
  return [
    {
      model: models.Post,
      required: true,
      attributes: [],
      include: getCommunityIncludes(id)
    }
  ]
};

const getCommunityIncludes = (id) => {
  return [
    {
      model: models.Group,
      required: true,
      attributes: [],
      include: [
        {
          model: models.Community,
          where: { id: id },
          required: true,
          attributes: []
        }
      ]
    }
  ]
};

const getPointGroupIncludes = (id) => {
  return [
    {
      model: models.Post,
      required: true,
      attributes: [],
      include: getGroupIncludes(id)
    }
  ]
};

const getGroupIncludes = (id) => {
  return [
    {
      model: models.Group,
      required: true,
      where: { id: id },
      attributes: []
    }
  ]
};

const countModelRowsByTimePeriod = (model, whereOptions, includeOptions, done) => {
  model.findAll({
    where: whereOptions,
    include: includeOptions,
    attributes: ['created_at']
  }).then((results) => {
    const days = _.groupBy(results, function (item) {
      return moment(item.created_at).format("DD/MM/YYYY");
    });

    const months = _.groupBy(results, function (item) {
      return moment(item.created_at).format("MM/YYYY");
    });

    const years = _.groupBy(results, function (item) {
      return moment(item.created_at).format("YYYY");
    });

    let dayCounts = _.map(days, function (items) {
      return { date: moment(items[0].created_at).format("YYYY/MM/DD"), count: items.length }
    });

    let monthsCounts = _.map(months, function (items) {
      return { date: moment(items[0].created_at).format("YYYY/MM"), count: items.length }
    });

    let yearsCounts = _.map(years, function (items) {
      return { date: moment(items[0].created_at).format("YYYY"), count: items.length }
    });

    dayCounts = _.orderBy(dayCounts, ['date'], ['asc']);
    monthsCounts = _.orderBy(monthsCounts, ['date'], ['asc']);
    yearsCounts = _.orderBy(yearsCounts, ['date'], ['asc']);

    done(null, {dayCounts, monthsCounts, yearsCounts});
  }).catch((error)=>{
    done(error);
  });
};

/*
countModelRowsByTimePeriod(models.AcActivity, {
  type: {
    $in: [
      "activity.post.new","activity.post.opposition.new","activity.post.endorsement.new",
      "activity.point.new","activity.point.helpful.new","activity.point.unhelpful.new"
    ]
  }
}, getCommunityIncludes(1017), 'day', (results) => {
  var a = results;
});

countModelRowsByTimePeriod(models.Point, {}, getPointDomainIncludes(1), (error, results) => {
  var a = results;
});

countModelRowsByTimePeriod(models.Post, {}, getDomainIncludes(1), (error, results) => {
  var a = results;
});

countModelRowsByTimePeriod(models.AcActivity, {
  type: {
    $in: [
      "activity.post.opposition.new","activity.post.endorsement.new",
      "activity.point.helpful.new","activity.point.unhelpful.new"
    ]
  }
}, getGroupIncludes(47), 'day', (results) => {
  var a = results;
});

countModelRowsByTimePeriod(models.AcActivity, {
  type: {
    $in: [
      "activity.user.login"
    ]
  },
  domain_id: 1
},[], (results) => {
  var a = results;
});

*/

const getFromAnalyticsApi = (featureType, collectionType, collectionId, done) => {
  const options = {
    url: process.env["AC_ANALYTICS_BASE_URL"]+featureType+"/"+process.env.AC_ANALYTICS_CLUSTER_ID+"/"+collectionId,
    headers: {
      'X-API-KEY': process.env["AC_ANALYTICS_KEY"]
    }
  };

  request.get(options, (error, content) => {
    done(error, content);
  });
};

router.get('/communities/:id/wordcloud', /*auth.can('edit community'),*/ function(req, res) {
  getFromAnalyticsApi("wordcloud", "community", req.params.id, function (error, content) {
    if (error) {
      log.error("Analytics Wordcloud Error Community", { communityId: req.params.id, userId: req.user ? req.user.id : null, errorStatus:  500 });
      res.sendStatus(500);
    } else {
      res.send(content);
    }
  });
});

router.get('/communities/:id/similarities_weights', /*auth.can('edit community'),*/ function(req, res) {
  getFromAnalyticsApi("similarities_weights", "community", req.params.id, function (error, content) {
    if (error) {
      log.error("Analytics Wordcloud Error Community", { communityId: req.params.id, userId: req.user ? req.user.id : null, errorStatus:  500 });
      res.sendStatus(500);
    } else {
      res.send(content);
    }
  });
});

router.get('/communities/:id/similarities_weights', auth.can('edit community'), function(req, res) {
  const options = {
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

router.get('/domains/:id', auth.can('view domain'), function(req, res) {
  const options = {
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
  const options = {
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
  const options = {
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
  const options = {
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