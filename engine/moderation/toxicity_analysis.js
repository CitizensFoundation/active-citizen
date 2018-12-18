const models = require("../../../models");
const async = require('async');
const moment = require('moment');
const log = require('../../utils/logger');
const _ = require('lodash');

const Perspective = require('perspective-api-client');
const perspectiveApi = new Perspective({apiKey: process.env.GOOGLE_PERSPECTIVE_API_KEY});

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
    callback(error, `${postName} ${postDescription}`);
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

const getToxicityScoreForPost = (postId, callback) => {
  if (process.env.GOOGLE_PERSPECTIVE_API_KEY) {
    models.Post.find({
      where: {
        id: postId
      },
      include: [
        {
          model: models.Group,
          attributes: ['id', 'access'],
          include: [
            {
              model: models.Community,
              required: true,
              attributes: ['id', 'access']
            }
          ]
        },
        {
          model: models.User,
          attribues: ['id','age_group']
        }
      ],
      attributes: ['id','name','description','language']
    }).then( post => {
      if (post) {
        let doNotStoreValue = post.Group.access===0 && post.Group.Community.access === 0;
        if (post.User.age_group && (post.User.age_group==="0-12" || post.User.age_group==="0"))
          doNotStoreValue = true;

        if (post.language && post.language.substring(0,2)==="en") {
          getToxicityScoreForText(post.name+" "+post.description, doNotStoreValue, callback);
        } else {
          getTranslatedTextForPost(post, (error, translatedText) => {
            if (error)
              callback(error);
            else
              getToxicityScoreForText(translatedText, doNotStoreValue, callback);
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

const getToxicityScoreForPoint = (pointId, callback) => {
  if (process.env.GOOGLE_PERSPECTIVE_API_KEY) {
    models.Point.find({
      attributes: ['id','language'],
      where: {
        id: pointId
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
              getToxicityScoreForText(translatedText, doNotStoreValue, callback);
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
  getToxicityScoreForPoint,
  getToxicityScoreForPost
};