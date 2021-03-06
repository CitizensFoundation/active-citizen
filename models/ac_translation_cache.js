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

  AcTranslationCache.allowedTextTypesForSettingLanguage = [
    "pointContent",
    "postName",
    "postContent",
    "groupName",
    "groupContent",
    "communityName",
    "communityContent",
    "domainName",
    "domainContent",
    "statusChangeContent"
  ]

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
  AcTranslationCache.getSurveyAnswerTranslations = async (postId, targetLanguage, done) => {
    targetLanguage = AcTranslationCache.fixUpLanguage(targetLanguage);
    sequelize.models.Post.unscoped().findOne({
      where: {
        id: postId
      },
      attributes: ['id','public_data','language']
    }).then(async (post) => {
      if (post.public_data &&
          post.public_data.structuredAnswersJson &&
          post.public_data.structuredAnswersJson.length>0) {
        const textStrings = [];
        let combinedText = "";
        for (const answer of post.public_data.structuredAnswersJson) {
          if (answer.value) {
            textStrings.push(answer.value);
            combinedText+=answer.value;
          } else {
            textStrings.push("");
          }
        }
        const contentHash = farmhash.hash32(combinedText).toString();
        let indexKey = `PostAnswer-${post.id}-${targetLanguage}-${contentHash}`;
        AcTranslationCache.getSurveyTranslations(indexKey, textStrings, targetLanguage, post, done);
      } else {
        done(null, []);
      }
    }).catch( error => {
      done(error);
    })
  }

  AcTranslationCache.addSubOptionsElements = (textStrings, combinedText, subOptions) => {
     for (let i=0;i<subOptions.length; i++) {
       const text = subOptions[i].text;
       if (text) {
         textStrings.push(text);
         combinedText+=text;
       } else {
         textStrings.push("");
       }
     }

     return combinedText;
   }

  AcTranslationCache.addSubOptionsToTranslationStrings = (textStrings, combinedText, question) => {
    if (question.radioButtons && question.radioButtons.length>0) {
      return AcTranslationCache.addSubOptionsElements(textStrings, combinedText, question.radioButtons);
    } else if (question.checkboxes && question.checkboxes.length>0) {
      return AcTranslationCache.addSubOptionsElements(textStrings, combinedText, question.checkboxes);
    } else if (question.dropdownOptions && question.dropdownOptions.length>0) {
      return AcTranslationCache.addSubOptionsElements(textStrings, combinedText, question.dropdownOptions);
    }
  }

  //TODO: Reduce amount of duplicate code
  AcTranslationCache.getRegistrationQuestionTranslations = async (groupId, targetLanguage, done) => {
    targetLanguage = AcTranslationCache.fixUpLanguage(targetLanguage);

    sequelize.models.Group.findOne({
      where: {
        id: groupId
      },
      attributes: ['id','configuration']
    }).then(async (group) => {
      if (group.configuration &&
        group.configuration.registrationQuestionsJson &&
        group.configuration.registrationQuestionsJson.length>0) {

        const textStrings = [];
        let combinedText = "";
        for (const question of group.configuration.registrationQuestionsJson) {
          if (question.text) {
            textStrings.push(question.text);
            combinedText+=question.text;
          } else {
            textStrings.push("");
          }

          if (question.type==="radios" || question.type==="checkboxes" || question.type==="dropdown" ) {
            combinedText = AcTranslationCache.addSubOptionsToTranslationStrings(textStrings, combinedText, question);
          }
        }
        const contentHash = farmhash.hash32(combinedText).toString();
        let indexKey = `GroupRegQuestions-${group.id}-${targetLanguage}-${contentHash}`;
        AcTranslationCache.getSurveyTranslations(indexKey, textStrings, targetLanguage, null, done);
      } else {
        done(null, []);
      }
    }).catch( error => {
      done(error);
    })
  }


  AcTranslationCache.getSurveyQuestionTranslations = async (groupId, targetLanguage, done) => {
    targetLanguage = AcTranslationCache.fixUpLanguage(targetLanguage);

    sequelize.models.Group.findOne({
      where: {
        id: groupId
      },
      attributes: ['id','configuration']
    }).then(async (group) => {
      if (group.configuration &&
          group.configuration.structuredQuestionsJson &&
          group.configuration.structuredQuestionsJson.length>0) {

        const textStrings = [];
        let combinedText = "";
        for (const question of group.configuration.structuredQuestionsJson) {
          if (question.text) {
            textStrings.push(question.text);
            combinedText+=question.text;
          } else {
            textStrings.push("");
          }

          if (question.type==="radios" || question.type==="checkboxes" || question.type==="dropdown" ) {
            AcTranslationCache.addSubOptionsToTranslationStrings(textStrings, combinedText, question);
          }
        }
        const contentHash = farmhash.hash32(combinedText).toString();
        let indexKey = `GroupQuestions-${group.id}-${targetLanguage}-${contentHash}`;
        AcTranslationCache.getSurveyTranslations(indexKey, textStrings, targetLanguage, null, done);
      } else {
        done(null, []);
      }
    }).catch( error => {
      done(error);
    })
  }

  AcTranslationCache.getSurveyTranslations = (indexKey, textStrings, targetLanguage, saveLanguageToModel, done) => {
    sequelize.models.AcTranslationCache.findOne({
      where: {
        index_key: indexKey
      }
    }).then(async translationModel => {
      if (translationModel) {
        done(null, JSON.parse(translationModel.content));
      } else {
        try {
          const results = await AcTranslationCache.getSurveyTranslationsFromGoogle(textStrings, targetLanguage);
          const translatedStrings = results[0];
          const languageInfo = results[1];
          if (translatedStrings && translatedStrings.length>0) {
            sequelize.models.AcTranslationCache.create({
              index_key: indexKey,
              content: JSON.stringify(translatedStrings)
            }).then(() => {
              if (saveLanguageToModel && languageInfo.data && languageInfo.data.translations && languageInfo.data.translations.length>0) {
                saveLanguageToModel.update({
                  language: languageInfo.data.translations[0].detectedSourceLanguage
                }).then(() => {
                  done(null, translatedStrings);
                }).catch( error => {
                  done(error);
                });
              } else {
                done(null, translatedStrings);
              }
            }).catch( error => {
              done(error);
            })
          } else {
            done(null, []);
          }
        } catch (error) {
          done(error);
        }
      }
    }).catch( error => {
      done(error);
    });

  }

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
              if (AcTranslationCache.allowedTextTypesForSettingLanguage.indexOf(textType)>-1) {
                modelInstance.update({
                  language: translation.detectedSourceLanguage
                }).then(() => {
                  callback(null, { content: translation.translatedText });
                }).catch( error => {
                  callback(error);
                });
              } else {
                callback(null, { content: translation.translatedText });
              }
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

  AcTranslationCache.fixUpLanguage = (targetLanguage) => {
    targetLanguage = targetLanguage.replace('_','-');

    if (targetLanguage!=='sr-latin' && targetLanguage!=='zh-CN' && targetLanguage!=='zh-TW') {
      targetLanguage = targetLanguage.split("-")[0];
    }

    if (targetLanguage==='sr-latin') {
      targetLanguage = 'sr-Latn';
    }

    return targetLanguage;
  }

  AcTranslationCache.getTranslation = (req, modelInstance, callback) => {

    const contentToTranslate = sequelize.models.AcTranslationCache.getContentToTranslate(req, modelInstance);
    if (contentToTranslate && contentToTranslate!=='' &&
      contentToTranslate.length>1 && isNaN(contentToTranslate)) {

      const contentHash = farmhash.hash32(contentToTranslate).toString();

      const textType = req.query.textType;

      let targetLanguage = req.query.targetLanguage;

      targetLanguage = AcTranslationCache.fixUpLanguage(targetLanguage);

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
