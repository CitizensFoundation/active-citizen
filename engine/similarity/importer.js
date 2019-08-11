const models = require('../../../models');
var _ = require('lodash');
const async = require('async');
const log = require('../../../utils/logger');
const request = require('request');

const ACTIVE_CITIZEN_PIO_APP_ID = 1;

let updateAsyncLimit = 42;

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

var importAllDomains = function (done) {
  log.info('AcSimilarityDomainImport', {});

  models.Domain.findAll({
        attributes: ['id','name','default_locale'],
        order: [
          ['id', 'asc' ]
        ]
      }).then(function (domains) {
    lineCrCounter = 0;
    async.eachOfLimit(domains, updateAsyncLimit,function (domain, index, callback) {

      var properties = {};

      properties = _.merge(properties,
          {
            name: domain.name,
            language: domain.default_locale
          });

      console.log("Domain language: "+properties.language);

      const options = {
        url: process.env["AC_SIMILARITY_API_BASE_URL"]+"domains/"+domain.id,
        headers: {
          'X-API-Key': process.env["AC_SIMILARITY_API_KEY"]
        },
        json: properties
      };

      request.post(options, (response) => {
        callback();
      });
    }, function () {
      console.log("Finished updating domains");
      done();
    });
  });
};

var importAllCommunities = function (done) {
  log.info('AcSimilarityCommunityImport', {});

  models.Community.findAll({
    include: [
      {
        model: models.Domain,
        attributes: ['id','default_locale'],
        required: true
      }
    ],
    attributes: ['id','name','default_locale'],
    order: [
      ['id', 'asc' ]
    ]
  }).then(function (communities) {
    lineCrCounter = 0;
    async.eachOfLimit(communities, updateAsyncLimit,function (community, index, callback) {

      var properties = {};

      properties = _.merge(properties,
          {
            name: community.name,
            language: community.default_locale ? community.default_locale : community.Domain.default_locale
          });
      console.log("Community language: "+properties.language);

      const options = {
        url: process.env["AC_SIMILARITY_API_BASE_URL"]+"communities/"+community.id,
        headers: {
          'X-API-Key': process.env["AC_SIMILARITY_API_KEY"]
        },
        json: properties
      };

      request.post(options, (response) => {
        callback();
      });
    }, function () {
      console.log("Finished updating communities");
      done();
    });
  });
};

var importAllGroups = function (done) {
  log.info('AcSimilarityGroupImport', {});

  models.Group.findAll({
    include: [
      {
        model: models.Community,
        attributes: ['id','access','status','default_locale'],
        required: true,
        include: [
          {
            model: models.Domain,
            attributes: ['id','default_locale'],
            required: true
          }
        ]
      }
    ],
    attributes: ['id','name'],
    order: [
      ['id', 'asc' ]
    ]
  }).then(function (groups) {
    lineCrCounter = 0;
    async.eachOfLimit(groups, updateAsyncLimit,function (group, index, callback) {

      var properties = {};

      properties = _.merge(properties,
          {
            name: group.name,
            language: group.Community.default_locale ? group.Community.default_locale : group.Community.Domain.default_locale
          });
      console.log("Group language: "+properties.language);

      const options = {
        url: process.env["AC_SIMILARITY_API_BASE_URL"]+"groups/"+group.id,
        headers: {
          'X-API-Key': process.env["AC_SIMILARITY_API_KEY"]
        },
        json: properties
      };

      request.post(options, (response) => {
        callback();
      });
    }, function () {
      console.log("Finished updating communities");
      done();
    });
  });
};

var importAllPosts = function (done) {
  log.info('AcSimilarityImport', {});

  models.Post.findAll(
    {
      include: [
        {
          model: models.Point,
          required: false,
          attributes: ['id','content'],
        },
        {
          model: models.Group,
          required: true,
          attributes: ['id','access','status'],
          include: [
            {
              model: models.Community,
              attributes: ['id','access','status','default_locale'],
              required: true,
              include: [
                {
                  model: models.Domain,
                  attributes: ['id','default_locale'],
                  required: true
                }
              ]
            }
          ]
        }
      ],
      order: [
        ['id', 'asc' ]
      ],
      attributes: ['id','name','description','group_id','category_id','status','deleted','language','created_at','user_id','official_status',
                   'counter_endorsements_up','counter_endorsements_down','counter_points','counter_flags']
    }).then(function (posts) {
    lineCrCounter = 0;
    async.eachOfLimit(posts, updateAsyncLimit,function (post, index, callback) {

      var properties = {};

      if (post.category_id) {
        properties = _.merge(properties,
          {
            category_id: convertToString(post.category_id)
          });
      }

      let language;
      if (post.language && post.language!=="??") {
        language=post.language;
      } else if (post.Group.default_locale) {
        language=post.Group.default_locale;
      } else if (post.Group.Community.default_locale) {
        language=post.Group.Community.default_locale;
      } else if (post.Group.Community.Domain.default_locale) {
        language=post.Group.Community.Domain.default_locale;
      }

      let description="";

      if (post.description) {
        description=post.description;
      } else if (post.Points[0]) {
        description=post.Points[0].content;
      }

      console.log("Language: "+language);
      console.log(description);

      //TODO: Add access attribute and images + fallback group images

      properties = _.merge(properties,
        {
          domain_id: convertToString(post.Group.Community.Domain.id),
          community_id: convertToString(post.Group.Community.id),
          group_id: convertToString(post.Group.id),
          description: description,
          counter_endorsements_up: post.counter_endorsements_up,
          counter_endorsements_down: post.counter_endorsements_down,
          counter_points: post.counter_points,
          counter_flags: post.counter_flags,
          name: post.name,
          status: post.deleted ? 'deleted' : post.status,
          official_status: convertToString(post.official_status),
          language: language
        });

      properties = _.merge(properties,
        {
          date: post.created_at.toISOString()
        }
      );
      const options = {
        url: process.env["AC_SIMILARITY_API_BASE_URL"]+"posts/"+post.id,
        headers: {
          'X-API-Key': process.env["AC_SIMILARITY_API_KEY"]
        },
        json: properties
      };

      request.post(options, (response) => {
        console.log(response);
        callback();
      });
    }, function () {
      console.log("Finished updating posts");
      done();
    });
  });
};

var importAll = function(done) {
  async.series([
    function(callback){
      importAllDomains(function () {
        callback();
      });
    },
    function(callback){
      importAllCommunities(function () {
        callback();
      });
    },
    function(callback){
      importAllGroups(function () {
        callback();
      });
    },
    function(callback){
      importAllPosts(function () {
        callback();
      });
    }
  ], function () {
    console.log("FIN");
    done();
  });
};

if (process.env["AC_SIMILARITY_API_KEY"] && process.env["AC_SIMILARITY_API_BASE_URL"] ) {
  log.info('AcSimilarityImportStarting', {});
  if (process.argv[2] && process.argv[2]=="onlyUpdatePosts") {
    updateAsyncLimit = 10;
    importAllPosts(function () {
      console.log("Done updating posts");
      process.exit();
    });
  } else {
    importAll(function () {
      console.log("Done importing all");
      process.exit();
    });
  }
} else {
  console.error("NO AC_SIMILARITY_API_KEY");
  process.exit();
}
