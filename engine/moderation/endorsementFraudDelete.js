const models = require('../../models');
const async = require('async');
const ip = require('ip');
const _ = require('lodash');
const fs = require('fs');
const request = require('request');

const recountCommunity = require('../../utils/recount_utils').recountCommunity;
const recountPost = require('../../utils/recount_utils').recountPost;

const communityId = process.argv[2];
const urlToConfig = process.argv[3];
const allowDeletingSingles = process.argv[4];

const allItems = [];
let deletedEndorsments = 0;

const processItemsToDestroy = (itemsToDestroy, postsToRecount, callback) => {
  async.forEachSeries(itemsToDestroy, (item, forEachItemCallback) => {
    models.Endorsement.findOne({
      where: {
        id: item.endorsementId
      },
      attributes: ['id']
    }).then( endorsement => {
      if (endorsement) {
        endorsement.deleted = true;
        endorsement.save().then(()=>{
          deletedEndorsments++;
          forEachItemCallback();
        }).catch( error => {
          forEachItemCallback(error);
        })
      } else {
        console.warn("Endorsement not found: "+item.endorsementId);
        forEachItemCallback();
      }
    }).catch( error => {
      forEachItemCallback(error);
    })
  }, error => {
    if (error) {
      callback(error)
    } else {
      if (postsToRecount.indexOf(itemsToDestroy[0].postId) == -1) {
        postsToRecount.push(itemsToDestroy[0].postId);
      }
      callback();
    }
  });
}

const getAllItemsExceptOne = (items) => {
  if (items.length===1 && allowDeletingSingles) {
    return items;
  } else {
    const sortedItems = _.sortBy(items, function (item) {
      return item.date;
    });

    const finalItems = [];
    let foundEmail = false;

    for (let i=0; i<sortedItems.length;i++) {
      if (!foundEmail && sortedItems[i].userEmail.indexOf("_anonymous@citizens.i") === -1) {
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


const deleteFraudulentEndorsements = (workPackage, done) => {
  const postsToRecount = [];

  async.series([
    (seriesCallback) => {
      let chunks;

      if (workPackage.type==="get-by-ip-address") {
        chunks = _.groupBy(allItems, function (endorsement) {
          return endorsement.ip_address;
        });
      } else if (workPackage.type==="get-by-ip-address-user-agent-post-id") {
        chunks = _.groupBy(allItems, function (endorsement) {
          return endorsement.ip_address+":"+endorsement.post_id+":"+endorsement.user_agent;
        });
      } else if (workPackage.type==="get-by-missing-fingerprint") {
        chunks = _.groupBy(allItems, function (endorsement) {
          return endorsement.data ? `${endorsement.data.browserId}:${endorsement.data.browserFingerprint}` : "nodata";
        });
      }

      async.forEachSeries(chunks, (items, forEachChunkCallback) => {
        const itemsToDestroy = getAllItemsExceptOne(items);
        if (itemsToDestroy.length>0) {
          processItemsToDestroy(itemsToDestroy, postsToRecount, forEachChunkCallback);
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
      recountCommunity(communityId, seriesCallback);
    }
  ], error => {
    if (error)
      console.error(error);
    else
      console.log(`Deleted ${deletedEndorsments} endorsements from community ${workPackage.communityId}`)
    done(error);
  });
}

module.exports = {
  deleteFraudulentEndorsements
};