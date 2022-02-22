const models = require('../../../../models');
const async = require('async');
const ip = require('ip');
const _ = require('lodash');
const fs = require('fs');
const request = require('request');
const moment = require("moment");

const recountCommunity = require('../../../../utils/recount_utils').recountCommunity;
const recountPost = require('../../../../utils/recount_utils').recountPost;

const processItemsToDestroy = (itemsToDestroy, communityId, postsToRecount, callback) => {
  // Make into chunks
  const idsToDestroy = itemsToDestroy.map( item => item.id);
  models.Endorsement.update({
      deleted: true
    }, {
      where: {
        id: {
          $in: idsToDestroy
        }
      },
      include: [
        {
          model: models.Post,
          attributes: ['id'],
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
                  },
                  required: true
                }
              ]
            }
          ]
        }
      ],
      attributes: ['id']
    }).then( endorsement => {
    if (postsToRecount.indexOf(itemsToDestroy[0].post_id) === -1) {
      postsToRecount.push(itemsToDestroy[0].post_id);
    }
    callback();
  });
}

const getAllItemsExceptOne = (items, allowDeletingSingles) => {
  if (items.length===1 && allowDeletingSingles) {
    return items;
  } else {
    const sortedItems = _.sortBy(items, function (item) {
      return item.date;
    });

    const finalItems = [];
    let foundEmail = false;

    for (let i=0; i<sortedItems.length;i++) {
      if (!foundEmail && sortedItems[i].User.email.indexOf("_anonymous@citizens.i") === -1) {
        foundEmail = true;
      } else {
        finalItems.push(sortedItems[i]);
      }
    }

    if (items.length===finalItems.length) {
      finalItems.pop();
    }

    return finalItems;
  }
}

const getAllowedSingleDelete = (workPackage) => {
  return workPackage.type==="delete-one-item"
}

const GetMomentInYourPriorities = (workPackage) => {
  if (workPackage.collectionType==="endorsements") {
    return moment("16/02/2022","DD/MM/YYYY").valueOf();
  } else {
    return moment("21/02/2022","DD/MM/YYYY").valueOf();
  }
}

const deleteFraudulentEndorsements = (workPackage, job, done) => {
  const postsToRecount = [];

  const allItemsIds = job.internal_data.idsToDelete;
  let allItems;

  if (allItemsIds && allItemsIds.length>0) {
    async.series([
      (seriesCallback) => {
        models.Endorsement.findAll({
          where: {
            id: {
              $in: allItemsIds
            }
          },
          attributes: ['id','value','ip_address','user_agent','data','post_id'],
          include: [
            {
              model: models.User,
              attributes: ['id','email']
            },
            {
              model: models.Post,
              attributes: ['id','name']
            }
          ]
        }).then( inItems => {
          if (inItems && inItems.length>0) {
            allItems = inItems;
            seriesCallback();
          } else {
            seriesCallback("No items")
          }
        }).catch( error => {
          seriesCallback(error);
        })
      },
      (seriesCallback) => {
        let chunks;

        // TODO: Share chunks in super base class of delete and get
        const filteredMissingFingerprints = _.filter(allItems, (endorsement) => {
          return endorsement.data &&
            (!endorsement.data.browserFingerprint ||
              !endorsement.data.browserId) &&
            moment(endorsement.created_at).valueOf()>GetMomentInYourPriorities(workPackage);
        });

        const filteredHasFingerprints = _.filter(allItems, (endorsement) => {
          return endorsement.data && endorsement.data.browserFingerprint;
        });

        if (workPackage.selectedMethod==="byIpAddress") {
          chunks = _.groupBy(allItems, function (endorsement) {
            return endorsement.ip_address;
          });
        } else if (workPackage.selectedMethod==="byIpFingerprint") {
          chunks = _.groupBy(filteredHasFingerprints, function (endorsement) {
            return endorsement.ip_address+":"+(endorsement.data ? endorsement.data.browserFingerprint : "na");
          });
        } else if (workPackage.selectedMethod==="byIpFingerprintPostId") {
          chunks = _.groupBy(filteredHasFingerprints, function (endorsement) {
            return endorsement.post_id+":"+endorsement.ip_address+":"+(endorsement.data ? endorsement.data.browserFingerprint : "na");
          });
        } else if (workPackage.selectedMethod==="byIpUserAgentPostId") {
          chunks = _.groupBy(allItems, function (endorsement) {
            return endorsement.ip_address+":"+endorsement.post_id+":"+endorsement.user_agent;
          });
        } else if (workPackage.selectedMethod==="byMissingBrowserFingerprint") {
          chunks = _.groupBy(filteredMissingFingerprints, function (endorsement) {
            return endorsement.data ? `${endorsement.data.browserId}:${endorsement.data.browserFingerprint}` : "nodata";
          });
        }

        async.forEachSeries(chunks, (items, forEachChunkCallback) => {
          const itemsToDestroy = getAllItemsExceptOne(items, getAllowedSingleDelete(workPackage));
          if (itemsToDestroy.length>0) {
            processItemsToDestroy(itemsToDestroy, workPackage.communityId, postsToRecount, forEachChunkCallback);
          } else {
            forEachChunkCallback();
          }
        }, error => {
          seriesCallback(error)
        });
      },
      (seriesCallback) => {
        async.forEachSeries(postsToRecount, (postId, forEachPostCallback) => {
          recountPost(postId, forEachPostCallback);
        }, error => {
          seriesCallback(error)
        });
      },
      (seriesCallback) => {
        recountCommunity(workPackage.communityId, seriesCallback);
      }
    ], error => {
      if (error)
        console.error(error);
      else
        console.log(`Deleted $deletedEndorsments endorsements from community ${workPackage.communityId}`)
      done(error);
    });
  } else {
    done("No items");
  }
}

const saveAuditToCollection = async (workPackage, job) => {
  models.GeneralDataStore.create({ data: { workPackage, deleteData: job.internal_data }}).then((dataItem)=> {
  //TODO
  });
}

const deleteItems = async (workPackage, done) => {
  console.log(`Delete data ${JSON.stringify(workPackage)}`)

  try {
    const job = await models.AcBackgroundJob.findOne({
      where: {
        id: workPackage.jobId
      }
    });

    console.log(`Delete data ${JSON.stringify(workPackage)} ${JSON.stringify(job)}`)

    deleteFraudulentEndorsements(workPackage, job, async (error) => {
      if (error) {
        await models.AcBackgroundJob.updateErrorAsync(workPackage.jobId, error);
        done();
      } else {
        await models.AcBackgroundJob.updateProgressAsync(workPackage.jobId, 100);
        done();
      }
    });
  } catch (error) {
    console.error(error);
    done(error);
  }
}

module.exports = {
  deleteItems
};