const models = require('../../../models');
const _ = require('lodash');
const async = require('async');
const log = require('../../../utils/logger');
const importDomain = require('./utils').importDomain;
const importCommunity = require('./utils').importCommunity;
const importGroup = require('./utils').importGroup;
const importPost = require('./utils').importPost;
const importPoint = require('./utils').importPoint;
const crypto = require('crypto');
const algorithm = 'aes-256-cbc';

const getEncryptedId = (id, key, iv) => {
  let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
  let encrypted = cipher.update(id.toString());
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return encrypted.toString('hex');
};

const saveAnonymousPost = (post, accessKey, done) => {
  console.log(accessKey);
  console.log(post);
  done();
};

const saveAnonymousPoint = (point, accessKey, done) => {
  console.log(accessKey);
  console.log(point);
  done();
};

const saveActivity = (activity, accessKey, done) => {
  console.log(accessKey);
  console.log(activity);
  done();
};

const saveAnonymousUser = (activity, accessKey, done) => {
  console.log(accessKey);
  console.log(activity);
  done();
};

const collectAllPostsAndPoints = (activities, collectedPostIds, collectedPointIds) => {
  activities.forEach((item)=>{
    if (item.Post) {
      collectedPostIds.push(item.Post.id);
    } else if (item.Point) {
      collectedPointIds.push(item.Post.id);
    } else {
      log.Error("Can't find post or point id for activity in anonymous export");
    }
  });
};

const sendAllCollectedPostAndPoints = (collectedPostIds, collectedPointIds, done) => {
  collectedPostIds = _.uniq(collectedPostIds);
  collectedPointIds = _.uniq(collectedPointIds);

  async.series([
    (seriesCallback) => {
      async.forEachSeries(collectedPostIds, (postId, forEachSeriesCallback) => {
        models.Post.findOne({
          where: {
            id: postId
          },
          attributes: ['id','name','description','public_data']
        }).then((post)=>{
          let req = {
            query: {
              textType: 'postContent',
              targetLanguage: 'en'
            }
          };
          models.AcTranslationCache.getTranslation(req, post, function (error, descriptionEn) {
            req = {
              query: {
                textType: 'postName',
                targetLanguage: 'en'
              }
            };
            models.AcTranslationCache.getTranslation(req, post, function (error, nameEn) {
              saveAnonymousPost({
                id: getEncryptedId((post.id), randomContentEncryptionKey, randomContentEncryptionIv),
                name: post.name,
                name_en: nameEn,
                description: post.description,
                description_en: descriptionEn
              }, accessKey, forEachSeriesCallback);
            });
          });
        }).catch((error)=> {
          forEachSeriesCallback(error);
        });
      },(error) => {
        seriesCallback(error);
      });
    },
    (seriesCallback) => {
      async.forEachSeries(collectedPointIds, (pointId, forEachSeriesCallback) => {
        models.Point.findOne({
          where: {
            id: pointId
          },
          order: [
            [ models.PointRevision, 'created_at', 'asc' ],
          ],
          attributes: ['id'],
          include: [
            {
              model: models.PointRevision,
              attributes: ['id','content']
            }
          ]
        }).then((point)=>{
          let req = {
            query: {
              textType: 'pointContent',
              targetLanguage: 'en'
            }
          };
          models.AcTranslationCache.getTranslation(req, point, function (error, contentEn) {
            saveAnonymousPoint({
              id: getEncryptedId((point.id), randomContentEncryptionKey, randomContentEncryptionIv),
              content: point.content,
              content_en: contentEn
            }, accessKey, forEachSeriesCallback);

          });
        }).catch((error)=> {
          forEachSeriesCallback(error);
        });
      },(error) => {
        seriesCallback(error);
      });
    },
  ], (error) => {
    done(error);
  })
};

const sendAllUserActivitiesWithContent = (userId, collectedPostIds, collectedPointIds, encryptionKey, encryptionIv, accessKey, done) => {
  models.AcActivity.findAll({
    where: {
      user_id: userId,
      type: {
        $in: [
          "activity.post.new","activity.post.opposition.new","activity.post.endorsement.new",
          "activity.point.new","activity.point.helpful.new","activity.point.unhelpful.new"
        ]
      },
      attributes: ['id','type'],
      include: [
        {
          model: models.Post,
          required: false,
          attributes: ['id']
        },
        {
          model: models.Point,
          required: false,
          attributes: ['id']
        }
      ]
    }
  }).then((activities) => {
    collectAllPostsAndPoints(activities, collectedPostIds, collectedPointIds);
    async.forEachSeries(activities, (activity, forEachSeriesCallback) => {
      saveActivity({
        id: getEncryptedId(activity.id, encryptionKey, encryptionIv),
        type: activity.type,
        post_id: activity.Post ? getEncryptedId(activity.Post.id, encryptionKey, encryptionIv) : null,
        point_id: activity.Point ? getEncryptedId(activity.Point.id, encryptionKey, encryptionIv) : null
      }, accessKey, forEachSeriesCallback);
    }, (error) => {
      done(error);
    });
  }).catch(function (error) {
    done(error);
  });
};

const importCommunityUsersAndActivities = (communityId, accessKey, done) => {
  const encryptionKey = crypto.randomBytes(32);
  const encryptionIv = crypto.randomBytes(16);
  let collectedPostIds = [];
  let collectedPointIds = [];

  models.Community.findOne({
    where: {
      id: communityId
    },
    include: [
      {
        model: models.User,
        attributes: ['id'],
        as: 'CommunityUsers',
        required: true,
      }
    ]
  }).then(function (community) {
    if (community && community.CommunityUsers) {
      async.forEachSeries(community.CommunityUsers, (user, eachSeriesCallback) => {
        saveAnonymousUser({
          id: getEncryptedId(user.id, encryptionKey, encryptionIv)
        }, accessKey, (error) => {
          if (error) {
            eachSeriesCallback(error);
          } else {
            sendAllUserActivitiesWithContent(user.id, collectedPostIds, collectedPointIds, encryptionKey, encryptionIv, accessKey, eachSeriesCallback);
          }
        })
      });
    } else {
      done("Could not find community");
    }
  }).catch(function (error) {
    if (error) {
      done(error);
    } else {
      sendAllCollectedPostAndPoints(collectedPostIds, collectedPointIds, (error) => {
        done(error);
      })
    }
  });
};

const updateCollection = (workPackage, done) => {
  if (process.env.AC_ANALYTICS_KEY &&
      process.env.AC_ANALYTICS_CLUSTER_ID &&
      process.env.AC_ANALYTICS_BASE_URL) {
    if (workPackage.domainId) {
      updateDomain(workPackage.domainId, done)
    } else if (workPackage.communityId) {
      updateCommunity(workPackage.communityId, done)
    } else if (workPackage.groupId) {
      updateGroup(workPackage.groupId, done)
    } else if (workPackage.postId) {
      updatePost(workPackage.postId, done)
    } else if (workPackage.pointId) {
      updatePoint(workPackage.pointId, done)
    } else {
      done("Couldn't find any collection to update similarities", { workPackage });
    }
  } else {
    log.warn("Can't find AC_ANALYTICS_KEY, AC_ANALYTICS_CLUSTER_ID & AC_ANALYTICS_BASE_URL for the similarities engine");
    done();
  }
};

module.exports = {
  updateCollection
};