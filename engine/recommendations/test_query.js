var predictionio = require('./predictionio-driver');
var models = require('../../../models');
var _ = require('lodash');
var async = require('async');
var engine = new predictionio.Engine({url: 'http://ac:8000'});

var getClient = function (appId) {
  return new predictionio.Events({appId: appId});
};

models.User.find({ where: {email:'robert@citizens.is'}}).then(function (user) {
  engine.sendQuery({
    user: user.id,
    fields: [
      {
        name: "domain",
        values: [1],
        bias: -1
      },
      {
        name: "status",
        values: ["published"],
        bias: -1
      }
    ],
    dateRange: {
      name: "date",
      before: "2017-12-30T23:04:45.000Z",
      after: "2010-02-15T23:04:45.000Z"
    }
  }).
  then(function (results) {
    console.log(results);
    var array = [];
    async.eachSeries(results.itemScores, function (item, callback) {
      console.log("ITEM");
      console.log(item.item);
      if (item && item.item) {
        models.Post.find({where:{ id: item.item }}).then(function(post) {
          console.log(post.name);
          console.log(post.status);
          console.log(post.created_at);
          callback();
        });
      } else {
        callback();
      }
    }, function () {
      getClient(1).getEvents({itemId: '2160'}).then(function(events) {
        console.log(events);
        _(events).forEach(function(event) {
          if (event.properties) {
            if (event.properties.community) {
              console.log("COMMUNITY COMMUNITY: ");
              console.log(event.properties.community);
            }
          }
        });
        callback();
      }).catch(function (error) {
        console.log("error");
        console.log(error);
        callback();
      });
    })
  });
});

