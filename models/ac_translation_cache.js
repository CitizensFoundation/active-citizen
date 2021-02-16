"use strict";

const { Translate }= require('@google-cloud/translate').v2;
const farmhash = require('farmhash');
const log = require('../utils/logger');

module.exports = (sequelize, DataTypes) => {
  let AcTranslationCache = sequelize.define("AcTranslationCache", {
    index_key: { type: DataTypes.STRING, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
  }, {

    indexes: [
      {
        name: 'main_index',
        fields: ['index_key']
      }
    ],

    underscored: true,

    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    tableName: 'translation_cache'
  });

  AcTranslationCache.getContentToTranslate = (req, modelInstance) => {
    switch(req.query.textType) {
      case 'postName':
      case 'domainName':
      case 'communityName':
      case 'groupName':
        return modelInstance.name;
      case 'postContent':
      case 'domainContent':
      case 'communityContent':
        return modelInstance.description;
      case 'pointContent':
        return modelInstance.PointRevisions[modelInstance.PointRevisions.length-1].content;
      case 'statusChangeContent':
        return modelInstance.content;
      case 'groupContent':
        return modelInstance.objectives;
      case 'pointAdminCommentContent':
        if (modelInstance.public_data &&
            modelInstance.public_data.admin_comment &&
            modelInstance.public_data.admin_comment.text) {
          return modelInstance.public_data.admin_comment.text;
        } else {
          return "Translation error";
        }
      case 'customRatingName':
        if (modelInstance.Group.configuration.customRatings &&
          modelInstance.Group.configuration.customRatings[modelInstance.custom_rating_index]) {
          return modelInstance.Group.configuration.customRatings[modelInstance.custom_rating_index].name
        } else {
          return "Translation error";
        }
      case 'alternativeTextForNewIdeaButton':
        return modelInstance.configuration.alternativeTextForNewIdeaButton;
      case 'alternativeTextForNewIdeaButtonClosed':
        return modelInstance.configuration.alternativeTextForNewIdeaButtonClosed;
      case 'alternativeTextForNewIdeaButtonHeader':
        return modelInstance.configuration.alternativeTextForNewIdeaButtonHeader;
      case 'customThankYouTextNewPosts':
        return modelInstance.configuration.customThankYouTextNewPosts;
      case 'customTitleQuestionText':
        return modelInstance.configuration.customTitleQuestionText;
      case 'customAdminCommentsTitle':
        return modelInstance.configuration.customAdminCommentsTitle;
      case 'alternativePointForHeader':
        return modelInstance.configuration.alternativePointForHeader;
      case 'alternativePointAgainstHeader':
        return modelInstance.configuration.alternativePointAgainstHeader;
      case 'alternativePointForLabel':
        return modelInstance.configuration.alternativePointForLabel;
      case 'alternativePointAgainstLabel':
        return modelInstance.configuration.alternativePointAgainstLabel;
      case 'categoryName':
        return modelInstance.name;
      case 'postTranscriptContent':
        return (modelInstance.public_data && modelInstance.public_data.transcript) ?
          modelInstance.public_data.transcript.text : null;
      default:
        console.error("No valid textType for translation");
        return null;
    }
  };

  // Post Edit
  // When AutoTranslate event ask for all the strings from the StructuredQuestions
  // Replace the StructuredQuestions with translates, store original value and redraw
  // When AutoTranslate stops reinstate the original structured questions

  // In Post
  // When AutoTranslate ask for all the strings for StructuredAnswers & Questions
  // Recreate structure and redraw
  // When AutoTranslate stops
  // Same in XLS and DOCX exports

  AcTranslationCache.getSurveyTranslationsFromGoogle = async (textsToTranslate, targetLanguage) => {
    //TODO: Implement a pagination for the max 128 strings limit of google translate
    return await new Promise(async (resolve, reject) => {
      const translateAPI = new Translate({
        credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
      });

      try {
        resolve(await translateAPI.translate(textsToTranslate, targetLanguage));
      } catch (error) {
        reject(error);
      }
    });
  };

  AcTranslationCache.getTranslationFromGoogle = (textType, indexKey, contentToTranslate, targetLanguage, modelInstance, callback) => {

    const translateAPI = new Translate({
      credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
    });

    translateAPI.translate(contentToTranslate, targetLanguage)
      .then((results) => {
        const translationResults = results[1];
        if (translationResults && translationResults.data
          && translationResults.data.translations &&
          translationResults.data.translations.length>0) {
          const translation = translationResults.data.translations[0];
          sequelize.models.AcTranslationCache.create({
            index_key: indexKey,
            content: translation.translatedText
          }).then(() => {
            if (textType==='postTranscriptContent' || textType==='pointAdminCommentContent') {
              if (textType==='postTranscriptContent') {
                modelInstance.set('public_data.transcript.language', translation.detectedSourceLanguage);
              } else {
                modelInstance.set('public_data.admin_comment.language', translation.detectedSourceLanguage);
              }
              modelInstance.save().then( () => {
                callback(null, { content: translation.translatedText });
              }).catch( error => {
                callback(error);
              });
            } else {
              modelInstance.update({
                language: translation.detectedSourceLanguage
              }).then(() => {
                callback(null, { content: translation.translatedText });
              });
            }
          }).catch((error) => {
            callback(error);
          });
        } else {
          callback("No translations");
        }
      }).catch((error) => {
      callback(error);
    });
  };

  AcTranslationCache.getTranslation = (req, modelInstance, callback) => {

    const contentToTranslate = sequelize.models.AcTranslationCache.getContentToTranslate(req, modelInstance);
    if (contentToTranslate && contentToTranslate!=='' &&
      contentToTranslate.length>1 && isNaN(contentToTranslate)) {

      const contentHash = farmhash.hash32(contentToTranslate).toString();

      const textType = req.query.textType;

      let targetLanguage = req.query.targetLanguage;

      targetLanguage = targetLanguage.replace('_','-');

      if (targetLanguage!=='sr-latin' && targetLanguage!=='zh-CN' && targetLanguage!=='zh-TW') {
        targetLanguage = targetLanguage.split("-")[0];
      }

      if (targetLanguage==='sr-latin') {
        targetLanguage = 'sr-Latn';
      }

      let indexKey = `${textType}-${modelInstance.id}-${targetLanguage}-${contentHash}`;

      sequelize.models.AcTranslationCache.findOne({
        where: {
          index_key: indexKey
        }
      }).then((translationModel) => {
        if (translationModel) {
          callback(null, { content: translationModel.content });
        } else {
          sequelize.models.AcTranslationCache.getTranslationFromGoogle(textType, indexKey, contentToTranslate, targetLanguage, modelInstance, callback);
        }
      }).catch((error) => {
        callback(error);
      });
    } else {
      log.warn("Empty or short string for translation", {
        textType: req.query.textType,
        targetLanguage: req.query.targetLanguage
      });
      if (!modelInstance.language) {
        modelInstance.update({
          language: '??'
        }).then(() => {
          callback(null, { content: contentToTranslate });
        }).catch( error => {
          callback(error);
        });
      } else {
        callback();
      }
    }
  };

  return AcTranslationCache;
};
