const queue = require('../../workers/queue');
const models = require("../../../models");
const i18n = require('../../utils/i18n');
const async = require('async');
const moment = require('moment');
const log = require('../../utils/logger');
const _ = require('lodash');
const fs = require('fs');
const Excel = require('exceljs');

const getGroupPosts = require('./common_utils').getGroupPosts;
const getContactData = require('./common_utils').getContactData;
const getAttachmentData = require('./common_utils').getAttachmentData;
const getMediaTranscripts = require('./common_utils').getMediaTranscripts;
const getPostRatings = require('./common_utils').getPostRatings;
const getPostUrl =  require('./common_utils').getPostUrl;
const getLocation =  require('./common_utils').getLocation;
const getCategory =  require('./common_utils').getCategory;
const getUserEmail = require('./common_utils').getUserEmail;

const getMediaFormatUrl = require('./common_utils').getMediaFormatUrl;
const getMediaURLs = require('./common_utils').getMediaURLs;
const getPointsUpOrDown = require('./common_utils').getPointsUpOrDown;
const getPointsUp = require('./common_utils').getPointsUp;
const getPointsDown = require('./common_utils').getPointsDown;

const getTranslatedPoints = require('./common_utils').getTranslatedPoints;
const getTranslation = require('./common_utils').getTranslation;

const getOrderedPosts = require('./common_utils').getOrderedPosts;
const updateJobStatusIfNeeded = require('./common_utils').updateJobStatusIfNeeded;
const setJobError = require('./common_utils').setJobError;

const preparePosts = require('./common_utils').preparePosts;

const uploadToS3 =  require('./common_utils').uploadToS3;
const sanitizeFilename = require("sanitize-filename");
const getImageFromUrl =  require('./common_utils').getImageFromUrl;

const setDescriptionsNewStyle = (group, post, buildPost) => {
  const structuredAnswers = {};
  const questionKeys = [];

  var questionComponents = group.configuration.structuredQuestionsJson;
  for (var i=0 ; i<questionComponents.length; i++) {
    if (questionComponents.uniqueId) {

    }
    questionKeys.push(questionComponents.uniqueId);
  }

  var answers = post.public_data.structuredAnswersJson;
  for (i=0 ; i<answers.length; i+=1) {
    if (answers[i]) {
      if (answers[i].value) {
        structuredAnswers[answers[i].uniqueId] = answers[i].value.trim();
      } else {
        structuredAnswers[answers[i].uniqueId] = null;
      }
    }
  }

  return structuredAnswers;
}

const setDescriptionsOldStyle = (group, post, buildPost) => {
  const structuredAnswers = {};
  const questionKeys = [];

  var questionComponents = group.configuration.structuredQuestions.split(",");
  for (var i=0 ; i<questionComponents.length; i+=2) {
    const question = questionComponents[i];
    questionKeys.push(question.replace(/ /g,''));
  }

  var answers = post.public_data.structuredAnswers.split("%!#x");
  for (i=0 ; i<answers.length; i+=1) {
    if (answers[i]) {
      const answerObject = {};
      answerObject[`${questionKeys[i]}`] = answers[i].trim();
      _.merge(structuredAnswers, answerObject);
    }
  }

  return structuredAnswers;
}

const setDescriptions = (group, post, builtPost) => {
  if (group && group.configuration && group.configuration.structuredQuestionsJson &&
    post.public_data.structuredAnswersJson) {
    return setDescriptionsNewStyle(group, post, builtPost);
  } else if (group && group.configuration && group.configuration.structuredQuestions &&
      group.configuration.structuredQuestions!=="" && typeof group.configuration.structuredQuestions==="string" &&
      post.public_data.structuredAnswers && post.public_data.structuredAnswers!=="") {
    return setDescriptionsOldStyle(group, post, builtPost);
  } else {
    return { description: builtPost.translatedDescription ? builtPost.translatedDescription : post.description}
  }
};

const getPointTextWithEverything = (group, post, point) => {
  let pointContent;
  let outText = "";
  if (post.translatedPoints && post.translatedPoints[point.id]) {
    pointContent = post.translatedPoints[point.id];
  } else {
    pointContent = point.PointRevisions[point.PointRevisions.length-1].content;
  }

  outText += moment(point.created_at).format("DD/MM/YY HH:mm")+" - "+point.User.name+" - "+point.User.email+"\n\n";
  outText += pointContent+"\n\n";

  if (point.public_data && point.public_data.admin_comment && point.public_data.admin_comment.text) {
    outText += (group.translatedCustomAdminCommentsTitle || group.configuration.customAdminCommentsTitle || "Admin comment")+ "\n";

    if (point.public_data.admin_comment.createdAt) {
      outText += moment(point.created_at).format("DD/MM/YY HH:mm")+" - "+point.public_data.admin_comment.userName+"\n\n";
    }

    let text = (post.translatedPoints && post.translatedPoints[point.id + "adminComments"]) || point.public_data.admin_comment.text || "";

    outText += text+"\n\n";
  }

  return outText;
};

const getContactDataRow = function (post) {
  if (post.data && post.data.contact && (post.data.contact.name || post.data.contact.email || post.data.contact.address || post.data.contact.telephone)) {
    return {
      contactName: post.data.contact.name,
      contactEmail: post.data.contact.email,
      contactTelephone: post.data.contact.telephone,
      contactAddress: post.data.contact.address
    }
  } else {
    return {};
  }
};

const getAttachmentDataRow = function (post) {
  if (post.data && post.data.attachment && post.data.attachment.url) {
    return {
      attachmentUrl: post.data.attachment.url,
      attachmentFilename: post.data.attachment.filename
    }
  } else {
    return {};
  }
};

const getPostRatingsRow = (customRatings, postRatings) => {
  let out = {};
  if (customRatings && customRatings.length>0) {
    customRatings.forEach( (rating, index) => {

      const oneOut = {};
      if (postRatings && postRatings[index]) {
        oneOut[rating.name+'count'] = postRatings[index].count;
        oneOut[rating.name+'average'] = postRatings[index].averageRating;
      } else {
        oneOut[rating.name+'count'] = 0;
        oneOut[rating.name+'average'] = 0;
      }
      _.merge(out, oneOut)
    });
  }
  return out;
};

const addPostToSheet = (worksheet, post, group) => {
  const mediaUrls = post.mediaURLs.replace(/"/g,'');
  const row = {
    postName: post.translatedName ? post.translatedName : post.name,
    postId: post.realPost.id,
    createdAt: moment(post.realPost.created_at).format("DD/MM/YY HH:mm"),
    email: post.userEmail,
    userName: post.userName,
    url: post.url,
    postLocale: post.realPost.language,
    images: post.images,
    upVotes: post.endorsementsUp,
    downVotes: post.endorsementsDown,
    pointsCount: post.counterPoints,
    mediaUrls: mediaUrls ? mediaUrls : " ",
    category: post.category ? post.category : " ",
    postTranscript: post.mediaTranscripts
  };

  _.merge(row, setDescriptions(group, post.realPost, post));

  if (group.configuration.moreContactInformation) {
    _.merge(row, getContactDataRow(post.realPost))
  }

  if (group.configuration.attachmentsEnabled) {
    _.merge(row, getAttachmentDataRow(post.realPost))
  }

  if (group.configuration.customRatings && post.realPost.public_data && post.realPost.public_data.ratings) {
    _.merge(row, getPostRatingsRow(group.configuration.customRatings, post.realPost.public_data.ratings));
  }

  if (!group.configuration.locationHidden && post.realPost.location) {
    _.merge(row, {
      latitude: post.realPost.location.latitude,
      longitude: post.realPost.location.longitude,
    })
  }

  let pointsUpText = "";
  const pointsUp = getPointsUp(post);

  pointsUp.forEach((point) => {
    pointsUpText += getPointTextWithEverything(group, post, point);
  });

  let pointsDownText = "";
  const pointsDown = getPointsDown(post);

  pointsDown.forEach((point) => {
    pointsDownText += getPointTextWithEverything(group, post, point);
  });

  _.merge(row, {
    pointsFor: pointsUpText,
    pointsAgainst: pointsDownText
  });

  worksheet.addRow(row);
};


const getDescriptionHeadersNewStyle = (group) => {
  var questionComponents = group.configuration.structuredQuestionsJson;
  let columnsStrings = [];

  for (var i=0 ; i<questionComponents.length; i++) {
    var question = questionComponents[i];
    if (question.uniqueId) {
      columnsStrings.push({ header: question.uniqueId+"-"+question.text, key: question.uniqueId, width: 45, style: { numFmt: '@' }  });
    }
  }

  return columnsStrings;
};

const getDescriptionHeadersOldStyle = (group) => {
  var structuredQuestions = [];

  var questionComponents = group.configuration.structuredQuestions.split(",");
  for (var i=0 ; i<questionComponents.length; i+=2) {
    var question = questionComponents[i];
    var maxLength = questionComponents[i+1];
    structuredQuestions.push({
      translatedQuestion: question,
      question: question,
      maxLength: maxLength, value: ""
    });
  }

  let columnsStrings = [];

  structuredQuestions.forEach((question) => {
    columnsStrings.push({ header: question.translatedQuestion, key: question.translatedQuestion.replace(/ /g,''), width: 45, style: { numFmt: '@' }  });
  });

  return columnsStrings;
};

const getDescriptionHeaders = (group) => {
  if (group && group.configuration.structuredQuestionsJson) {
    return getDescriptionHeadersNewStyle(group);
  } else if (group && group.configuration.structuredQuestions && group.configuration.structuredQuestions!=="") {
    return getDescriptionHeadersOldStyle(group);
  } else {
    return { header: 'Description', key: 'description', width: 45, style: { numFmt: '@' }  };
  }
};

const getRatingHeaders = (customRatings) => {
  let out = [];
  if (customRatings && customRatings.length>0) {
    customRatings.forEach( (rating) => {
      out.push({header: rating.name+' count', key: rating.name+'count', width: 20});
      out.push({header: rating.name+' average', key: rating.name+'average', width: 10});
    });
  }
  return out;
};

const setWrapping = (worksheet) => {
  for (let rowIndex=0; rowIndex <= worksheet.rowCount; rowIndex++) {
    const row = worksheet.getRow(rowIndex);
    row.eachCell({includeEmpty: true}, (cell => {
      if (cell._column._key==="pointsFor" || cell._column._key==="pointsAgainst") {
        cell.alignment = { vertical: 'top', wrapText: true };
      }
    }));
  }

  worksheet.getRow(1).font = { bold: true };
//  worksheet.properties.defaultRowHeight = 20;
};

async function exportToXls (options, callback) {
  const jobId = options.jobId;
  const groupId = options.groupId;
  const group = options.group;
  const posts = options.posts;
  let categories = options.categories;
  const customRatings = options.customRatings;

  const title = "Export for Group Id: "+group.id;

  const ratingsHeaders = getRatingHeaders(customRatings);

  const workbook = new Excel.Workbook();

  workbook.creator = "Your Priorities - Automated";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(group.translatedName ? group.translatedName : group.name);

  let columns = [
    { header: 'Created', key: 'createdAt', width: 15 },
    { header: 'Post Id', key: 'postId', width: 15 },
    { header: 'User name', key: 'userName', width: 30 },
    { header: 'Email', key: 'email', width: 30 }
  ];

  if (group.configuration.moreContactInformation) {
    columns.push(
      { header: 'Contact Name', key: 'contactName', width: 30 },
      { header: 'Contact Email', key: 'contactEmail', width: 30 },
      { header: 'Contact telephone', key: 'contactTelephone', width: 20 }
    );
  }

  if (group.configuration.moreContactInformationAddress) {
    columns.push(
      { header: 'Contact Address', key: 'contactAddress', width: 50 }
    );
  }

  if (group.configuration.attachmentsEnabled) {
    columns.push(
      { header: 'Attachment URL', key: 'attachmentUrl', width: 30 },
      { header: 'Attachment filename', key: 'attachmentFilename', width: 30 }
    );
  }

  columns.push(
    { header: 'Post name', key: 'postName', width: 45, style: { numFmt: '@' }  }
  );

  columns = columns.concat(getDescriptionHeaders(group));

  columns.push(
    { header: 'Locale', key: 'postLocale', width: 10 }
  );

  if (!group.configuration.locationHidden) {
    columns.push(
      { header: 'Latitude', key: 'latitude', width: 15 },
      { header: 'Longitude', key: 'longitude', width: 15 }
    )
  }

  columns.push(
    { header: 'URL', key: 'url', width: 20 },
    { header: 'Category', key: 'category', width: 15 },
    { header: 'Up Votes', key: 'upVotes', width: 15 },
    { header: 'Down Votes', key: 'downVotes', width: 15 },
  );

  if (ratingsHeaders) {
    columns = columns.concat(ratingsHeaders);
  }

  let pointForHeader = group.translatedAlternativePointForHeader || group.configuration.alternativePointForHeader || 'Points For';
  let pointAgainstHeader =  group.translatedAlternativePointAgainstHeader || group.configuration.alternativePointAgainstHeader || 'Points Against';

  columns.push(
    { header: 'Points Count', key: 'pointsCount', width: 15},
    { header: pointForHeader, key: 'pointsFor', width: 55, style: { numFmt: '@' }  },
    { header: pointAgainstHeader, key: 'pointsAgainst', width: 55, style: { numFmt: '@' }  },
    { header: 'Images', key: 'images', width: 20 },
    { header: 'Media URLs', key: 'mediaUrls', width: 15 },
    { header: 'Post transcript', key: 'postTranscript', width: 15 },
  );

  worksheet.columns = columns;

  let processedCount = 0;
  let lastReportedCount = 0;
  const totalPostCount = posts.length;
  if (categories.length===0) {
    async.eachSeries(getOrderedPosts(posts), (post, eachCallback) =>{
      addPostToSheet(worksheet, post, group);
      processedCount += 1;
      updateJobStatusIfNeeded(jobId, totalPostCount, processedCount, lastReportedCount, (error, haveSent) => {
        if (haveSent)
          lastReportedCount = processedCount;
        eachCallback(error)
      })
    }, async (error) => {
      if (error) {
        callback(error);
      } else {
        setWrapping(worksheet);
        const buffer = await workbook.xlsx.writeBuffer();
        callback(null, buffer);
      }
    });
  } else {
    async.series([
      (seriesCallback) => {
        categories = _.orderBy(categories, [category=>category]);
        async.eachSeries(categories, (category, categoryCallback) => {
          async.eachSeries(getOrderedPosts(posts), (post, eachCallback) =>{
            if (post.category===category) {
              addPostToSheet(worksheet, post, group);
              processedCount += 1;
              updateJobStatusIfNeeded(jobId, totalPostCount, processedCount, lastReportedCount, (error, haveSent) => {
                if (haveSent) {
                  lastReportedCount = processedCount;
                }
                eachCallback(error)
              })
            } else {
              eachCallback();
            }
          }, (error) => {
            categoryCallback(error);
          });
        }, (error) => {
          seriesCallback(error);
        });
      },
      (seriesCallback) => {
        const postsWithoutCategories = [];
        posts.forEach((post) =>{
          if (!post.category) {
            postsWithoutCategories.push(post);
          }
        });

        if (postsWithoutCategories.length>0) {
          async.eachSeries(getOrderedPosts(postsWithoutCategories), (post, eachCallback) =>{
            addPostToSheet(worksheet, post, group);
            processedCount += 1;
            updateJobStatusIfNeeded(jobId, totalPostCount, processedCount, lastReportedCount, (error, haveSent) => {
              if (haveSent) {
                lastReportedCount = processedCount;
              }
              eachCallback(error)
            })
          }, (error) => {
            seriesCallback(error);
          });
        } else {
          seriesCallback();
        }
      },
    ], async (error) => {
      if (error) {
        callback(error);
      } else {
        setWrapping(worksheet);
        const buffer = await workbook.xlsx.writeBuffer();
        callback(null, buffer);
      }
    });
  }
};

const createXlsReport = (workPackage, callback) => {
  let exportOptions, exportedData, filename;

  async.series([
    (seriesCallback) => {
      models.Group.findOne({
        where: {
          id: workPackage.groupId
        },
        attributes: ['id','name','objectives','configuration','community_id'],
        include: [
          {
            model: models.Image,
            as: 'GroupLogoImages',
            attributes:  models.Image.defaultAttributesPublic,
            required: false
          }
        ],
        order: [
          [ { model: models.Image, as: 'GroupLogoImages' } , 'created_at', 'desc' ],
        ]
      }).then((group) => {
        workPackage.group = group;
        const dateString = moment(new Date()).format("DD_MM_YY_HH_mm");
        const groupName = sanitizeFilename(group.name).replace(/ /g,'');
        workPackage.filename = 'Ideas_and_Points_Group_Export_'+group.community_id+'_'+group.id+'_'+
          groupName+'_'+dateString+'.'+workPackage.exportType;
        seriesCallback();
      }).catch( error => {
        seriesCallback(error);
      })
    },
    (seriesCallback) => {
      preparePosts(workPackage, (error, options) => {
        exportOptions = options;
        seriesCallback(error);
      });
    },
    (seriesCallback) => {
      models.AcBackgroundJob.update(
        {
          progress: 5
        }, {
          where: { id: workPackage.jobId }
        }).then(()=>{
        seriesCallback();
      }).catch((error)=>{
        seriesCallback(error);
      });
    },
    (seriesCallback) => {
      exportToXls(exportOptions, (error, data) => {
        exportedData = data;
        seriesCallback(error);
      });
    },
    (seriesCallback) => {
      uploadToS3(workPackage.jobId, workPackage.userId, workPackage.filename, workPackage.exportType, exportedData, (error, reportUrl) => {
        if (error) {
          seriesCallback(error);
        } else {
          models.AcBackgroundJob.update(
            {
              progress: 100,
              data: { reportUrl }
            }, {
              where: { id: workPackage.jobId }
            }).then(()=>{
            seriesCallback();
          }).catch((error)=>{
            seriesCallback(error);
          });
        }
      });
    }
  ], (error) => {
    if (error) {
      setJobError(workPackage.jobId, "errorXlsReportGeneration", error, dbError =>{
        callback(dbError || error);
      });
    } else {
      callback();
    }
  });
};

module.exports = {
  createXlsReport
};