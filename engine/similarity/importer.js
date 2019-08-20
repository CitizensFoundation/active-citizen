const models = require('../../../models');
var _ = require('lodash');
const async = require('async');
const log = require('../../../utils/logger');
const request = require('request');

const ACTIVE_CITIZEN_PIO_APP_ID = 1;

let updateAsyncLimit = 16;

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

const _getVideoURL = function(videos) {
  if (videos &&
      videos.length>0 &&
      videos[0].formats &&
      videos[0].formats.length>0) {
    return videos[0].formats[0];
  } else {
    return null;
  }
};

const _getAudioURL = function (audios) {
  if (audios &&
      audios.length>0 &&
      audios[0].formats &&
      audios[0].formats.length>0) {
    return audios[0].formats[0];
  } else {
    return null;
  }
};

const _getVideoPosterURL = function(videos, images, selectedImageIndex) {
  if (videos &&
      videos.length>0 &&
      videos[0].VideoImages &&
      videos[0].VideoImages.length>0) {
    if (!selectedImageIndex)
      selectedImageIndex = 0;
    if (videos[0].public_meta && videos[0].public_meta.selectedVideoFrameIndex) {
      selectedImageIndex = parseInt(videos[0].public_meta.selectedVideoFrameIndex);
    }
    if (selectedImageIndex>videos[0].VideoImages.length-1) {
      selectedImageIndex = 0;
    }
    if (selectedImageIndex===-2 && images) {
      return this.getImageFormatUrl(images, 0);
    } else {
      if (selectedImageIndex<0)
        selectedImageIndex = 0;
      return JSON.parse(videos[0].VideoImages[selectedImageIndex].formats)[0];
    }
  } else {
    return null;
  }
};

const _getImageFormatUrl = function(images, formatId) {
  if (images && images.length>0) {
    var formats = JSON.parse(images[images.length-1].formats);
    if (formats && formats.length>0)
      return formats[formatId];
  } else {
    return "";
  }
};


const _hasCoverMediaType = function (post, mediaType) {
  if (!post) {
    console.info("No post for "+mediaType);
    return false;
  } else {
    if (mediaType == 'none') {
      return (!post.Category && (!post.cover_media_type || post.cover_media_type == 'none'));
    } else  if ((mediaType=='category' && post.Category) && (!post.cover_media_type || post.cover_media_type == 'none')) {
      return true;
    } else {
      return (post && post.cover_media_type == mediaType);
    }
  }
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
          attributes: ['id','access','status','configuration'],
          include: [
            {
              attributes: ['id','formats'],
              model: models.Image, as: 'GroupLogoImages',
              required: false
            },
            {
              model: models.Community,
              attributes: ['id','access','status','default_locale'],
              required: true,
              include: [
                {
                  attributes: ['id','formats'],
                  model: models.Image, as: 'CommunityLogoImages',
                  required: false
                },
                {
                  model: models.Domain,
                  attributes: ['id','default_locale'],
                  required: true
                }
              ]
            }
          ]
        },
        {
          model: models.Image,
          required: false,
          as: 'PostHeaderImages',
          attributes: ['id','formats']
        },
        {
          model: models.Video,
          required: false,
          attributes: ['id','formats','updated_at','viewable','public_meta'],
          as: 'PostVideos',
          include: [
            {
              model: models.Image,
              as: 'VideoImages',
              attributes:["formats",'updated_at'],
              required: false
            },
          ]
        },
        {
          model: models.Audio,
          required: false,
          attributes: ['id','formats','updated_at','listenable'],
          as: 'PostAudios',
        }
      ],
      order: [
        ['id', 'desc' ],
        [ { model: models.Image, as: 'PostHeaderImages' } ,'updated_at', 'asc' ],
        [ { model: models.Group }, { model: models.Image, as: 'GroupLogoImages' } , 'created_at', 'desc' ],
        [ { model: models.Group }, { model: models.Community }, { model: models.Image, as: 'CommunityLogoImages' } , 'created_at', 'desc' ]
      ],
      attributes: ['id','name','description','group_id','category_id','status','deleted','language','created_at',
                   'user_id','official_status','public_data','cover_media_type',
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

      if (post.public_data && post.public_data.structuredAnswers) {
        const answers = post.public_data.structuredAnswers.split("%!#x");
        description = answers.join(" ");
      }

      let publicAccess = false;

      if ((post.Group.access===models.Group.ACCESS_PUBLIC &&
          post.Group.Community.access===models.Community.ACCESS_PUBLIC) ||
          (post.Group.access===models.Group.ACCESS_OPEN_TO_COMMUNITY &&
          post.Group.Community.access===models.Community.ACCESS_PUBLIC)
      ) {
        publicAccess = true;
      }

      let communityAccess = false;

      if (post.Group.access===models.Group.ACCESS_PUBLIC || post.Group.access===models.Group.ACCESS_OPEN_TO_COMMUNITY) {
        communityAccess = true;
      }

      let formats, audioUrl, videoUrl;
      let imageUrl = null;

      if (_hasCoverMediaType(post, "image") && post.PostHeaderImages && post.PostHeaderImages.length>0) {
        imageUrl = _getImageFormatUrl(post.PostHeaderImages, 0);
      } else if (_hasCoverMediaType(post, "video") && post.Videos && post.Videos.length>0) {
        imageUrl = _getVideoPosterURL(post.Videos, post.Images, 0);
        videoUrl = _getVideoURL(post.Videos);
      } else if (_hasCoverMediaType(post, "audio") && post.Audios && post.Audios.length>0) {
        audioUrl = _getAudioURL(post.Audios);
      }

      console.log("Image URL before: "+imageUrl);


      if (!imageUrl) {
        if (post.Group.GroupLogoImages && post.Group.GroupLogoImages.length>0) {
          formats = JSON.parse(post.Group.GroupLogoImages[0].formats);
          imageUrl = formats[0];
        } else if (post.Group.Community.CommunityLogoImages && post.Group.Community.CommunityLogoImages.length>0) {
          formats = JSON.parse(post.Group.Community.CommunityLogoImages[0].formats);
          imageUrl = formats[0];
        }
      }

      console.log("Image URL after: "+imageUrl);
      console.log("Language: "+language);
      console.log(description);

      //TODO: Add endorsements up and down for ratings for 3d maps
      //TODO: Add English translation if there and make train english maps for all items

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
          imageUrl: imageUrl,
          videoUrl: videoUrl,
          communityAccess: communityAccess,
          audioUrl: audioUrl,
          publicAccess: publicAccess,
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

      if (true) {
        request.post(options, (response) => {
          console.log(response);
          callback();
        });
      } else {
        callback();
      }
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
    updateAsyncLimit = 8;
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
