const models = require('../../models');
const async = require('async');
const ip = require('ip');
const _ = require('lodash');
const fs = require('fs');
const request = require('request');
const farmhash = require('farmhash');

const communityId = process.argv[2];
const targetLocale = process.argv[3];
const urlToConfig =  process.argv[4];

let config;
let changeCount = 0;

const searchAndReplaceTranslation = (textType, id, content, done) => {
  const indexKey = `${textType}-${id}-${targetLocale}-${farmhash.hash32(content).toString()}`;
  models.AcTranslationCache.findOne({
    where: {
      index_key: indexKey
    }
  }).then((result) => {
    if (result) {
      const newContent = result.content;
      config.split('\r\n').forEach(searchLine => {
        const searchLineSplit = searchLine.split(",");
        if (newContent.indexOf(searchLineSplit[0]) > -1) {
          const regExp = new RegExp(searchLineSplit[0], 'g');
          newContent.replace(regExp, searchLineSplit[1]);
          changeCount += 1;
        }
      });

      if (false && newContent!==result.content) {
        result.set('content', newContent);
        result.save().then(function () {
          console.log(`Updated ${result.index_key} to ${result.content}`);
          done;
        }).catch(error => {
          done(error);
        })
      } else {
        done();
      }
    } else {
      console.warn("Not found: "+indexKey);
      done();
    }
  }).catch((error)=>{
    done(error);
  });
};

const updateTranslationForPosts = (posts, done) => {
  async.forEachSeries(posts, (post, forEachCallback) => {
    searchAndReplaceTranslation('postName', post.id, post.name, (error) => {
      if (error) {
        done(error)
      } else {
        searchAndReplaceTranslation('postContent', post.id, post.description, (error) => {
          done(error);
        });
      }
    });
  }, error => {
    done(error);
  })
};

async.series([
  (seriesCallback) => {
    const options = {
      url: urlToConfig,
    };

    request.get(options, (error, content) => {
      if (content && content.statusCode!==200) {
        seriesCallback(content.statusCode);
      } else {
        config = content.body;
        seriesCallback();
      }
    });
  },
  (seriesCallback) => {
    async.series([
      (innerSeriesCallback) => {
        models.Post.findAll({
          attributes: ['id','name','description'],
          include: [
            {
              model: models.Group,
              attributes: ['id'],
              include: [
                {
                  model: models.Community,
                  attributes: ['id'],
                  where: {
                    id: communityId
                  }
                }
              ]
            }
          ]
        }).then(posts=>{
          updateTranslationForPosts(posts, innerSeriesCallback);
        }).catch(error=>{
          innerSeriesCallback(error);
        })
      },
      (innerSeries) => {
        models.Group.findAll({
          attributes: ['id','name','objective'],
          include: [
            {
              model: models.Community,
              attributes: ['id'],
              where: {
                id: communityId
              }
            }
          ]
        }).then(groups=>{
          updateTranslationForGroups(groups, innerSeriesCallback);
        }).catch(error=>{
          innerSeriesCallback(error);
        })
      },
      (innerSeries) => {
        models.Community.find({
          attributes: ['id','name','description'],
        }).then(community=>{
          updateTranslationForCommunity(community, innerSeriesCallback);
        }).catch(error=>{
          innerSeriesCallback(error);
        })
      }
    ], (error) => {
      seriesCallback(error);
    })
  },
], error => {
  if (error)
    console.error(error);
  console.log(`All done with ${changeCount} changes`);
  process.exit();
});
