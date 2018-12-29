const models = require("../../../models");
const async = require('async');
const moment = require('moment');
const log = require('../../utils/logger');
const _ = require('lodash');

const TOXICITY_THRESHOLD = 0.40;
const SEVERE_TOXICITY_THRESHOLD = 0.30;
const TOXICITY_EMAIL_THRESHOLD = 0.75;
const SEVERE_TOXICITY_EMAIL_THRESHOLD = 0.65;



const Perspective = require('perspective-api-client');
let perspectiveApi;
if (process.env.GOOGLE_PERSPECTIVE_API_KEY) {
  perspectiveApi = new Perspective({apiKey: process.env.GOOGLE_PERSPECTIVE_API_KEY});
}

const getToxicityScoreForText = (text, doNotStore, callback) => {
  perspectiveApi.analyze(text, { doNotStore, attributes: [
    'TOXICITY', 'SEVERE_TOXICITY','IDENTITY_ATTACK',
    'THREAT','INSULT','PROFANITY','SEXUALLY_EXPLICIT',
    'FLIRTATION'] }).then( result => {
    callback(null, result);
  }).catch( error => {
    callback(error);
  });
};

const setupModelPublicDataScore = (model, results) => {
  if (!model.data)
    model.set('data', {});
  if (!model.data.moderation)
    model.set('data.moderation', {});
  model.set('data.moderation.rawToxicityResults', results);

  let toxicityScore, severeToxicityScore, identityAttackScore, threatScore, insultScore,
    profanityScore, sexuallyExplicitScore, flirtationScore;

  try {
    toxicityScore = results.attributeScores["TOXICITY"].summaryScore.value;
    severeToxicityScore = results.attributeScores["SEVERE_TOXICITY"].summaryScore.value;
    identityAttackScore = results.attributeScores["IDENTITY_ATTACK"].summaryScore.value;
    threatScore = results.attributeScores["THREAT"].summaryScore.value;
    insultScore = results.attributeScores["INSULT"].summaryScore.value;
    profanityScore = results.attributeScores["PROFANITY"].summaryScore.value;
    sexuallyExplicitScore = results.attributeScores["SEXUALLY_EXPLICIT"].summaryScore.value;
    flirtationScore = results.attributeScores["FLIRTATION"].summaryScore.value;
  } catch (error) {
    log.error(error);
  }

  model.set('data.moderation.toxicityScore', toxicityScore);
  model.set('data.moderation.severeToxicityScore', severeToxicityScore);
  model.set('data.moderation.identityAttackScore', identityAttackScore);
  model.set('data.moderation.threatScore', threatScore);
  model.set('data.moderation.insultScore', insultScore);
  model.set('data.moderation.profanityScore', profanityScore);
  model.set('data.moderation.sexuallyExplicitScore', sexuallyExplicitScore);
  model.set('data.moderation.flirtationScore', flirtationScore);
};

const hasModelBreachedToxicityThreshold = model => {
  if (model.data && model.data.moderation && (model.data.moderation.toxicityScore || model.data.moderation.severeToxicityScore)) {
    if (model.data.moderation.toxicityScore>TOXICITY_THRESHOLD ||
        model.data.moderation.severeToxicityScore>SEVERE_TOXICITY_THRESHOLD) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
};

const hasModelBreachedToxicityEmailThreshold = model => {
  if (model.data && model.data.moderation && (model.data.moderation.toxicityScore || model.data.moderation.severeToxicityScore)) {
    if (model.data.moderation.toxicityScore>TOXICITY_EMAIL_THRESHOLD ||
      model.data.moderation.severeToxicityScore>SEVERE_TOXICITY_EMAIL_THRESHOLD) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
};

const getTranslatedTextForPost = (post, callback) => {
  let postName, postDescription;
  async.parallel([
    (parallelCallback) => {
      const req = { query: {
        textType: 'postName',
        targetLanguage: 'en'
      }};
      models.TranslationCache.getTranslation(req, post, (error, translation) => {
        if (error) {
          parallelCallback(error);
        } else {
          postName = translation;
          parallelCallback();
        }
      });
    },
    (parallelCallback) => {
      const req = { query: {
        textType: 'postContent',
        targetLanguage: 'en'
      }};
      models.TranslationCache.getTranslation(req, post, (error, translation) => {
        if (error) {
          parallelCallback(error);
        } else {
          postDescription = translation;
          parallelCallback();
        }
      });
    }
  ], error => {
    callback(error, `${postName.content} ${postDescription.content}`);
  });
};

const getTranslatedTextForPoint = (point, callback) => {
  const req = {
    query: {
      textType: 'pointContent',
      targetLanguage: 'en'
    }
  };
  models.TranslationCache.getTranslation(req, point, (error, translation) => {
    if (error) {
      callback(error);
    } else {
      callback(null, translation);
    }
  });
};

const estimateToxicityScoreForPost = (options, callback) => {
  if (process.env.GOOGLE_PERSPECTIVE_API_KEY) {
    models.Post.find({
      where: {
        id: options.postId
      },
      include: [
        {
          model: models.Audio,
          as: 'PostAudios',
          required: false
        },
        {
          model: models.Video,
          as: 'PostVideos',
          required: false
        },
        {
          model: models.Group,
          attributes: ['id', 'access'],
          include: [
            {
              model: models.Community,
              required: true,
              attributes: ['id', 'access'],
              include: [
                {
                  model: models.Domain,
                  required: true,
                  attributes: ['id']
                }
              ]
            }
          ]
        },
        {
          model: models.User,
          attribues: ['id','age_group']
        }
      ],
      attributes: ['id','name','description','language','data','group_id']
    }).then( post => {
      if (post) {
        let doNotStoreValue = post.Group.access===0 && post.Group.Community.access === 0;
        if (post.User.age_group && (post.User.age_group==="0-12" || post.User.age_group==="0"))
          doNotStoreValue = true;

        let textContent;

        if (options.useTranscript && post.useVideo && post.PostVideos && post.PostVideos.length>0 &&
            post.PostVideos[post.PostVideos.length-1].meta && post.PostVideos[0].meta.text) {
          textContent = post.PostVideos[post.PostVideos.length-1].meta.text;
        } else if (options.useTranscript && post.useAudio && post.PostAudios && post.PostAudios.length>0 &&
            post.PostAudios[post.PostAudios.length-1].meta && post.PostVideos[post.PostAudios.length-1].meta.text) {
          textContent = post.PostAudios[post.PostAudios.length-1].meta.text;
        } else {
          textContent = post.name+" "+post.description;
        }

        if (post.language && post.language.substring(0,2)==="en") {
          getToxicityScoreForText(textContent, doNotStoreValue, callback);
        } else {
          getTranslatedTextForPost(post, (error, translatedText) => {
            if (error)
              callback(error);
            else
              getToxicityScoreForText(translatedText, doNotStoreValue, (error, results) => {
                if (error) {
                  callback(error);
                } else {
                  setupModelPublicDataScore(post, results);
                  post.save().then(() => {
                    if (hasModelBreachedToxicityThreshold(post)) {
                      post.report({ disableNotification: !hasModelBreachedToxicityEmailThreshold(post) },
                                  "perspectiveAPI",
                                  callback);
                    } else {
                      callback();
                    }
                  }).catch( error => {
                    callback(error);
                  })
                }
              });
          });
        }
      } else {
        callback("Could not find post");
      }
    }).catch( error => {
      callback(error);
    })
  } else {
    callback("No API key");
  }
};

const estimateToxicityScoreForPoint = (options, callback) => {
  if (process.env.GOOGLE_PERSPECTIVE_API_KEY) {
    models.Point.find({
      attributes: ['id','language','data','post_id','group_id'],
      where: {
        id: options.pointId
      },
      include: [
        {
          model: models.Group,
          attributes: ['id', 'access'],
          required: false,
          include: [
            {
              model: models.Community,
              required: false,
              attributes: ['id', 'access']
            }
          ]
        },
        {
          model: models.PointRevision,
          attribues: ['id','content']
        },
        {
          model: models.User,
          attribues: ['id','age_group']
        }
      ]
    }).then( point => {
      if (point) {
        let doNotStoreValue = true;
        if (point.Group.access===0 && point.Group.Community.access === 0)
          doNotStoreValue = false;

        if (point.User.age_group && (point.User.age_group==="0-12" || point.User.age_group==="0"))
          doNotStoreValue = true;

        const latestContent = point.PointRevisions[point.PointRevisions.length-1].content;

        if (point.language && point.language.substring(0,2)==="en") {
          getToxicityScoreForText(latestContent, doNotStoreValue, callback);
        } else {
          getTranslatedTextForPoint(point, (error, translatedText) => {
            if (error)
              callback(error);
            else
              getToxicityScoreForText(translatedText.content, doNotStoreValue, (error, results) => {
                if (error) {
                  callback(error);
                } else {
                  setupModelPublicDataScore(point, results);
                  point.save().then(() => {
                    if (hasModelBreachedToxicityThreshold(point)) {
                      if (point.post_id) {
                        models.Post.find({
                          where: {
                            id: point.post_id
                          },
                          attributes: ["id",'data'],
                          include: [
                            {
                              model: models.Group,
                              attributes: ['id'],
                              include: [
                                {
                                  model: models.Community,
                                  attributes: ['id'],
                                  include: [
                                    {
                                      model: models.Domain,
                                      attributes: ['id']
                                    }
                                  ]
                                }
                              ]
                            }
                          ]
                        }).then(post => {
                          point.report({ disableNotification: !hasModelBreachedToxicityEmailThreshold(point) },
                                       'perspectiveAPI',
                                        post, callback);
                        }).catch( error => {
                          callback(error);
                        });
                      } else {
                        point.report({ disableNotification: !hasModelBreachedToxicityEmailThreshold(point) },
                                    'perspectiveAPI', null, callback);
                      }
                    } else {
                      callback();
                    }
                  }).catch( error => {
                    callback(error);
                  })
                }
              });
          });
        }
      } else {
        callback("Could not find point");
      }
    }).catch( error => {
      callback(error);
    })
  } else {
    callback("No API key");
  }
};

module.exports = {
  estimateToxicityScoreForPoint,
  estimateToxicityScoreForPost
};