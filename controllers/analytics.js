const express = require('express');
const router = express.Router();
const models = require("../../models");
const auth = require('../../authorization');
const log = require('../utils/logger');
const toJson = require('../utils/to_json');
const moment = require('moment');
const _ = require('lodash');
const request = require('request');

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
  //TODO: Add 5 minute caching
  model.findAll({
    where: whereOptions,
    include: includeOptions,
    attributes: ['created_at'],
    order: [['created_at','ASC']]
  }).then((results) => {
    const startDate = moment(results[0].created_at);
    const endDate = moment(results[results.length-1].created_at);

    const days = _.groupBy(results, function (item) {
      return moment(item.created_at).format("YYYY/MM/DD");
    });

    const months = _.groupBy(results, function (item) {
      return moment(item.created_at).format("YYYY/MM");
    });

    const years = _.groupBy(results, function (item) {
      return moment(item.created_at).format("YYYY");
    });

    const totalDaysCount = endDate.diff(startDate, 'days', false)+2;
    let currentDate =  moment(results[0].created_at);
    let finalDays = [];
    for (let i = 0; i < totalDaysCount; i++) {
      const currentDateText = currentDate.format("YYYY/MM/DD");
      if (days[currentDateText]) {
        finalDays.push({ x: currentDate.format("YYYY-MM-DD"), y: days[currentDateText].length })
      } else {
    //    finalDays.push({ x: currentDate.format("YYYY-MM-DD"), y: 0})
      }
      currentDate = currentDate.add(1, "days");
    }

    const totalMonthsCount = endDate.diff(startDate, 'months', false)+2;
    let currentMonth = moment(results[0].created_at);
    let finalMonths = [];
    for (let i = 0; i < totalMonthsCount; i++) {
      const currentMonthText = currentMonth.format("YYYY/MM");
      if (months[currentMonthText]) {
        finalMonths.push({ x: currentMonth.format("YYYY-MM"), y: months[currentMonthText].length })
      } else {
    //    finalMonths.push({ x: currentMonth.format("YYYY-MM"), y: 0})
      }
      currentMonth = currentMonth.add(1, "months");
    }

    const totalYearsCount = endDate.diff(startDate, 'years', false)+2;
    let currentYear = moment(results[0].created_at);
    let finalYears = [];
    for (let i = 0; i < totalYearsCount; i++) {
      const currentYearText = currentYear.format("YYYY");
      if (years[currentYearText]) {
        finalYears.push({ x: currentYearText, y: years[currentYearText].length })
      } else {
//        finalYears.push({ x: currentYearText, y: 0})
      }
      currentYear = currentYear.add(1, "years");
    }

    done(null, {finalDays, finalMonths, finalYears});
  }).catch((error)=>{
    done(error);
  });
};

/*
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
  //TODO: Implement cache
  const options = {
    url: process.env["AC_ANALYTICS_BASE_URL"]+featureType+"/"+collectionType+"/"+process.env.AC_ANALYTICS_CLUSTER_ID+"/"+collectionId,
    headers: {
      'X-API-KEY': process.env["AC_ANALYTICS_KEY"]
    }
  };

  request.get(options, (error, content) => {
    if (content && content.statusCode!=200) {
      error = content.statusCode;
    }
    done(error, content);
  });
};

const triggerSimilaritiesTraining = (collectionType, collectionId, done) => {
  const options = {
    url: process.env["AC_ANALYTICS_BASE_URL"]+"trigger_similarities_training"+"/"+collectionType+"/"+process.env.AC_ANALYTICS_CLUSTER_ID+"/"+collectionId,
    headers: {
      'X-API-KEY': process.env["AC_ANALYTICS_KEY"]
    },
    json: {}
  };

  request.put(options, (error, content) => {
    if (content && content.statusCode!=200) {
      error = content.statusCode;
    }
    done(error, content);
  });
};

const sendBackResultsOrError = (req,res,error,results) => {
  if (error) {
    log.error("Analytics Error", { id: req.params.id, url: req.url, userId: req.user ? req.user.id : null, errorStatus:  500 });
    res.sendStatus(500);
  } else {
    res.send(results);
  }
};

// WORD CLOUD
router.get('/domains/:id/wordcloud', /*auth.can('edit community'),*/ function(req, res) {
  getFromAnalyticsApi("wordclouds", "domain", req.params.id, function (error, content) {
    sendBackResultsOrError(req,res,error,content);
  });
});

router.get('/communities/:id/wordcloud', /*auth.can('edit community'),*/ function(req, res) {
  triggerSimilaritiesTraining("community", req.params.id, ()=>{})
  getFromAnalyticsApi("wordclouds", "community", req.params.id, function (error, content) {
    sendBackResultsOrError(req,res,error,content);
  });
});

router.get('/groups/:id/wordcloud', /*auth.can('edit community'),*/ function(req, res) {
  getFromAnalyticsApi("wordclouds", "group", req.params.id, function (error, content) {
    sendBackResultsOrError(req,res,error,content);
  });
});

// SIMILARITIES
router.get('/domains/:id/similarities_weights', /*auth.can('edit community'),*/ function(req, res) {
  getFromAnalyticsApi("similarities_weights", "domain", req.params.id, function (error, content) {
    sendBackResultsOrError(req,res,error ? error : content.body ? null : 'noBody', JSON.parse(content.body));
  });
});

router.get('/communities/:id/similarities_weights', /*auth.can('edit community'),*/ function(req, res) {
  getFromAnalyticsApi("similarities_weights", "community", req.params.id, function (error, content) {
    sendBackResultsOrError(req,res,error ? error : content.body ? null : 'noBody', JSON.parse(content.body));
  });
});

router.get('/groups/:id/similarities_weights', /*auth.can('edit community'),*/ function(req, res) {
  getFromAnalyticsApi("similarities_weights", "group", req.params.id, function (error, content) {
    sendBackResultsOrError(req,res,error ? error : content.body ? null : 'noBody', JSON.parse(content.body));
  });
});

// STATS
router.get('/domains/:id/stats_posts', /*auth.can('edit community'),*/ function(req, res) {
  countModelRowsByTimePeriod(models.Post, {}, getDomainIncludes(req.params.id), (error, results) => {
    sendBackResultsOrError(req,res,error, results);
  });
});

router.get('/domains/:id/stats_points', /*auth.can('edit community'),*/ function(req, res) {
  countModelRowsByTimePeriod(models.Point, {}, getPointDomainIncludes(req.params.id), (error, results) => {
    sendBackResultsOrError(req,res,error, results);
  });
});

router.get('/domains/:id/stats_votes', /*auth.can('edit community'),*/ function(req, res) {
  countModelRowsByTimePeriod(models.AcActivity, {
    type: {
      $in: [
        "activity.post.opposition.new","activity.post.endorsement.new",
        "activity.point.helpful.new","activity.point.unhelpful.new"
      ]
    }
  }, getDomainIncludes(req.params.id), 'day', (error, results) => {
    sendBackResultsOrError(req,res,error,results);
  });
});

router.get('/communities/:id/stats_posts', /*auth.can('edit community'),*/ function(req, res) {
  countModelRowsByTimePeriod(models.Post, {}, getCommunityIncludes(req.params.id), (error, results) => {
    sendBackResultsOrError(req,res,error, results);
  });
});

router.get('/communities/:id/stats_points', /*auth.can('edit community'),*/ function(req, res) {
  countModelRowsByTimePeriod(models.Point, {}, getPointCommunityIncludes(req.params.id), (error, results) => {
    sendBackResultsOrError(req,res,error, results);
  });
});

router.get('/communities/:id/stats_votes', /*auth.can('edit community'),*/ function(req, res) {
  countModelRowsByTimePeriod(models.AcActivity, {
    type: {
      $in: [
        "activity.post.opposition.new","activity.post.endorsement.new",
        "activity.point.helpful.new","activity.point.unhelpful.new"
      ]
    }
  }, getCommunityIncludes(req.params.id), (error, results) => {
    sendBackResultsOrError(req,res,error,results);
  });
});

router.get('/groups/:id/stats_posts', /*auth.can('edit community'),*/ function(req, res) {
  countModelRowsByTimePeriod(models.Post, {}, getGroupIncludes(req.params.id), (error, results) => {
    sendBackResultsOrError(req,res,error, results);
  });
});

router.get('/groups/:id/stats_points', /*auth.can('edit community'),*/ function(req, res) {
  countModelRowsByTimePeriod(models.Point, {}, getPointGroupIncludes(req.params.id), (error, results) => {
    sendBackResultsOrError(req,res,error, results);
  });
});

router.get('/groups/:id/stats_votes', /*auth.can('edit community'),*/ function(req, res) {
  countModelRowsByTimePeriod(models.AcActivity, {
    type: {
      $in: [
        "activity.post.opposition.new","activity.post.endorsement.new",
        "activity.point.helpful.new","activity.point.unhelpful.new"
      ]
    }
  }, getGroupIncludes(req.params.id), 'day', (error, results) => {
    sendBackResultsOrError(req,res,error,results);
  });
});





module.exports = router;
