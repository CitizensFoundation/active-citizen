const queue = require('../../workers/queue');
const models = require("../../../models");
const i18n = require('../../utils/i18n');
const async = require('async');
const moment = require('moment');
const log = require('../../utils/logger');
const _ = require('lodash');

const Perspective = require('perspective-api-client');
const perspectiveApi = new Perspective({apiKey: process.env.GOOGLE_PERSPECTIVE_API_KEY});

const getToxicityScoreForText = (text, doNotStore, callback) => {
  perspectiveApi.analyze(text, { doNotStore }).then( result => {
    callback(null, result);
  }).catch( error => {
    callback(error);
  });
};

const getTranslatedTextForPost = (post, callback) => {
  let postName, postDescription;
  async.parallel([
    (parallelCallback) => {
      
    }
  ], error => {
    callback(error, postName, postDescription);
  });
};

const getToxicityScoreForPost = (postId, callback) => {
  if (process.env.GOOGLE_PERSPECTIVE_API_KEY) {
    models.Post.find({
      where: {
        id: postId
      },
      attributes: ['id','name','description','language']
    }).then( post => {

      if (post.language && post.language.substring(0,2)==="en") {
        getToxicityScoreForText(post.name+" "+post.description, callback);
      } else {
        getTranslatedTextForPost(post, (error, translatedText) => {
          if (error)
            callback(error);
          else
            getToxicityScoreForText(translatedText, callback);
        });
      }
    }).catch( error => {
      callback(error);
    })
  } else {
    callback("No API key");
  }
};
