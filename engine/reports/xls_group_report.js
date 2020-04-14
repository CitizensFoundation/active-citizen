const queue = require('../../workers/queue');
const models = require("../../../models");
const i18n = require('../../utils/i18n');
const async = require('async');
const moment = require('moment');
const log = require('../../utils/logger');
const _ = require('lodash');
const docx = require('docx');
const fs = require('fs');

const { Document, Packer, Paragraph, Table, TableCell, UnderlineType, HeadingLevel, AlignmentType, Media, TableRow } = docx;

const getGroupPosts = require('./common_utils').getGroupPosts;
const getRatingHeaders = require('./common_utils').getRatingHeaders;
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


const createDocWithStyles = (title) => {
  return new Document({
    creator: "Your Priorities Export",
    title: title,
    description: "Group export from Your Priorities",
    styles: {
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            size: 35,
            bold: true,
            italics: false,
            color: "black",
          },
          paragraph: {
            spacing: {
              after: 250,
              before: 100,
            },
          },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            size: 26,
            bold: true,
            italics: false,
            color: "black",
          },
          paragraph: {
            spacing: {
              after: 140,
            },
          },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            size: 65,
            bold: true
          },
          paragraph: {
            spacing: {
              before: 600,
              after: 120,
            },

          },
        },
        {
          id: "aside",
          name: "Aside",
          basedOn: "Normal",
          next: "Normal",
          run: {
            color: "999999",
            italics: true,
          },
          paragraph: {
            indent: {
              left: 720,
            },
            spacing: {
              line: 276,
            },
          },
        },
        {
          id: "wellSpaced",
          name: "Well Spaced",
          basedOn: "Normal",
          quickFormat: true,
          paragraph: {
            spacing: { line: 276, before: 20 * 72 * 0.1, after: 20 * 72 * 0.05 },
          },
        },
        {
          id: "ListParagraph",
          name: "List Paragraph",
          basedOn: "Normal",
          quickFormat: true,
        },
      ],
    }
  });
};

const setDescriptions = (group, post, builtPost, children) => {
  if (group && group.configuration && group.configuration.structuredQuestions && group.configuration.structuredQuestions!=="") {
    var structuredAnswers = [];

    var questionComponents = group.configuration.structuredQuestions.split(",");
    for (var i=0 ; i<questionComponents.length; i+=2) {
      var question = questionComponents[i];
      var maxLength = questionComponents[i+1];
      structuredAnswers.push({
        translatedQuestion: question.trim(),
        question: question,
        maxLength: maxLength, value: ""
      });
    }

    if (post.public_data && post.public_data.structuredAnswers && post.public_data.structuredAnswers!=="") {
      var answers = post.public_data.structuredAnswers.split("%!#x");
      for (i=0 ; i<answers.length; i+=1) {
        if (structuredAnswers[i])
          structuredAnswers[i].value = answers[i].trim();
      }
    } else {
      structuredAnswers[0].value = post.description;
    }

    structuredAnswers.forEach((questionAnswer) => {
      children.push(
        new Paragraph({
          text: questionAnswer.translatedQuestion,
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph(questionAnswer.value),
      )
    });
  } else {
    children.push(
      new Paragraph(builtPost.translatedDescription ? builtPost.translatedDescription : post.description)
    );
  }
};

const addPointTranslationIfNeeded = (post, point, children) => {
  if (post.translatedPoints && post.translatedPoints[point.id]) {
    children.push(
      new Paragraph(post.translatedPoints[point.id])
    );
  } else {
    children.push(
      new Paragraph(point.content)
    );
  }
  children.push(
    new Paragraph("")
  );
};

const addPostToDoc = (doc, post, group) => {
  const children = [
    new Paragraph({
      text: post.translatedName ? post.translatedName : post.name,
      heading: HeadingLevel.HEADING_1,
    })
  ];

  setDescriptions(group, post.realPost, post, children);

  children.push(
    new Paragraph(""),
    new Paragraph("Original locale: "+post.realPost.language),
    new Paragraph("URL: "+ post.url),
    new Paragraph(""),
    new Paragraph("User email: "+ post.userEmail),
    new Paragraph("User name: "+ post.userName),
    new Paragraph(""),
    new Paragraph("Endorsements up: "+ post.endorsementsUp),
    new Paragraph("Endorsements down: "+ post.endorsementsDown),
    new Paragraph("Counter points: "+ post.counterPoints),
    new Paragraph("")
  );

  if (post.images && post.images.length>5) {
    children.push(
      new Paragraph("Image URLs: "+ post.images)
    );
    children.push(
      new Paragraph("")
    );
  }

  if (post.postRatings) {
    children.push(
      new Paragraph("Ratings: "+ post.postRatings)
    )
  }

  if (post.mediaURLs && post.mediaURLs.length>4) {
    children.push(
      new Paragraph("Media URLs: "+ post.mediaURLs)
    )
  }

  if (post.category) {
    children.push(
      new Paragraph("Category: "+ post.category)
    )
  }

  if (post.location && post.location.length>6) {
    children.push(
      new Paragraph("Location: "+ post.location)
    )
  }

  if (post.mediaTranscripts && post.mediaTranscripts.length>4) {
    children.push(
      new Paragraph("")
    );
    children.push(
      new Paragraph("Media transcripts: \n"+ post.mediaTranscripts)
    )
  }

  if (post.contactData && post.contactData.length>4) {
    children.push(
      new Paragraph("ContactData: "+ post.contactData)
    )
  }

  if (post.attachmentData && post.attachmentData.length>4) {
    children.push(
      new Paragraph("Attachment data: "+ post.attachmentData)
    )
  }

  const pointsUp = getPointsUp(post);

  children.push(
    new Paragraph({
      text: pointsUp.length>0 ? (pointsUp.length===1 ? "Point for" : "Points for") : "No points for",
      heading: HeadingLevel.HEADING_2,
    }));

  pointsUp.forEach((point) => {
    addPointTranslationIfNeeded(post, point, children);
  });

  const pointsDown = getPointsDown(post);
  children.push(
    new Paragraph({
      text: pointsDown.length>0 ? (pointsDown.length===1 ? "Point against" : "Points against") : "No points against",
      heading: HeadingLevel.HEADING_2,
    }),
  );

  pointsDown.forEach((point) => {
    addPointTranslationIfNeeded(post, point, children);
  });

  doc.addSection({
    children: children
  });
};

const setupGroup = (doc, group, ratingsHeaders, title, done) => {
  let imageUrl, imageFilename;
  if (group.GroupLogoImages && group.GroupLogoImages.length>0) {
    const firstImageFormats =  JSON.parse(group.GroupLogoImages[0].formats);
    imageUrl = firstImageFormats[1];
  }

  async.series([
    (seriesCallback) => {
      if (imageUrl) {
        getImageFromUrl(imageUrl, (error, imageFile) => {
          if (error) {
            seriesCallback(error)
          } else {
            imageFilename = imageFile;
            seriesCallback();
          }
        })
      } else {
        seriesCallback();
      }
    },

    (seriesCallback) => {
      const children = [];

      if (imageFilename) {
        const image1 = Media.addImage(doc, fs.readFileSync(imageFilename), 432,243);
        children.push(new Paragraph(image1));
      }

      children.push(
        new Paragraph({
          text: title,
          heading: HeadingLevel.HEADING_1,
        }),

        new Paragraph({
          text: group.translatedName ? group.translatedName : group.name,
          heading: HeadingLevel.HEADING_1,
        }),

        new Paragraph(group.translatedObjectives ? group.translatedObjectives : group.objectives)
      );

      if (ratingsHeaders && ratingsHeaders.length>5) {
        children.push(
          new Paragraph({
            text: "Ratings options",
            heading: HeadingLevel.HEADING_1,
          }),

          new Paragraph(ratingsHeaders)
        );
      }

      if (group.targetTranslationLanguage) {
        children.push(
          new Paragraph(""),
          new Paragraph({
            text: "Automatically machine translated to locale: "+group.targetTranslationLanguage.toUpperCase(),
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph("")
        )
      }

      doc.addSection({
        children: children
      });

      seriesCallback();
    }
  ],(error) => {
    done(error);
  })
};

const exportToXls = (options, callback) => {
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

  const worksheet = workbook.addWorksheet('Export: '+group.name);

  outFileContent += "Nr, Post id,email,User Name,Post Name,"+getDescriptionHeaders(group)+",Url,Category," +
    "Latitude,Longitude,Up Votes,Down Votes,Points Count,Points For,Points Against,Images,Contact Name," +
    "Contact Email,Contact telephone,Attachment URL,Attachment filename,Media URLs," +
    "Post transcript"+getRatingHeaders(customRatings)+"\n";


  const columns = [
    { header: 'Nr', key: 'nr', width: 10 },
    { header: 'Post Id', key: 'postId', width: 10 },
    { header: 'Email', key: 'email', width: 15 },
    { header: 'User name', key: 'userName', width: 30 },
    { header: 'Post name', key: 'postName', width: 30 }
  ];

  columns.push(
    { header: 'URL', key: 'url', width: 20 },
    { header: 'Category', key: 'category', width: 15 },
    { header: 'Latitude', key: 'latitude', width: 10 },
    { header: 'Longitude', key: 'longitude', width: 10 },
    { header: 'Up Votes', key: 'upVotes', width: 10 },
    { header: 'Down Votes', key: 'downVotes', width: 10 },
    { header: 'Points Count', key: 'pointsCount', width: 10 },
    { header: 'Points For', key: 'pointsFor', width: 30 },
    { header: 'Points Against', key: 'pointsAgainst', width: 30 },
    { header: 'Images', key: 'latitude', width: 10 },
    { header: 'Contact Name', key: 'latitude', width: 10 },
    { header: 'Contact Email', key: 'latitude', width: 10 },
    { header: 'Contact telephone', key: 'latitude', width: 10 },
    { header: 'Attachment URL', key: 'latitude', width: 10 },
    { header: 'Attachment filename', key: 'latitude', width: 10 },
    { header: 'Media URLs', key: 'latitude', width: 10 },
    { header: 'Post transcript', key: 'latitude', width: 10 },
  );



  worksheet.columns = columns;

  let processedCount = 0;
  let lastReportedCount = 0;
  const totalPostCount = posts.length;

  setupGroup(doc, group, ratingsHeaders, title, (error) => {
    if (error) {
      callback(error)
    } else {
      if (categories.length===0) {
        async.eachSeries(getOrderedPosts(posts), (post, eachCallback) =>{
          addPostToDoc(doc, post, group);
          processedCount += 1;
          updateJobStatusIfNeeded(jobId, totalPostCount, processedCount, lastReportedCount, (error, haveSent) => {
            if (haveSent)
              lastReportedCount = processedCount;
            eachCallback(error)
          })
        }, (error) => {
          if (error) {
            callback(error);
          } else {
            Packer.toBase64String(doc).then(b64string=>{
              callback(null, Buffer.from(b64string, 'base64'));
            });
          }
        });
      } else {
        async.series([
          (seriesCallback) => {
            categories = _.orderBy(categories, [category=>category]);
            async.eachSeries(categories, (category, categoryCallback) => {
              const children = [
                new Paragraph({
                  text: category,
                  heading: HeadingLevel.HEADING_3,
                  alignment: AlignmentType.CENTER
                })
              ];

              doc.addSection({
                children: children
              });

              async.eachSeries(getOrderedPosts(posts), (post, eachCallback) =>{
                if (post.category===category) {
                  addPostToDoc(doc, post, group);
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
              doc.addSection({
                children: [
                  new Paragraph({
                    text: "Posts without a category",
                    heading: HeadingLevel.HEADING_1,
                  })
                ]
              });

              async.eachSeries(getOrderedPosts(postsWithoutCategories), (post, eachCallback) =>{
                addPostToDoc(doc, post, group);
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
        ], (error) => {
          if (error) {
            callback(error);
          } else {
            Packer.toBase64String(doc).then(b64string=>{
              callback(null, Buffer.from(b64string, 'base64'));
            });
          }
        });
      }
    }

  });
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
        workPackage.filename = 'ideas_and_points_group_export_'+group.community_id+'_'+group.id+'_'+
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
      exportToDocx(exportOptions, (error, data) => {
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