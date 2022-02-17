const models = require('../../../models');
const _ = require('lodash');
const moment = require('moment');
const ColorHash = require('color-hash').default;

const average = arr => arr.reduce((a,b) => a + b, 0) / arr.length;

const setWeightedConfidenceScore = (items, score) => {
  const averageScore =  average([score, getTimeDifferentScores(items)]).toFixed(2);
  _.forEach(items, item=>{
    item.confidenceScore = averageScore;
  })
}

const getTimeDifferentScores = (items) => {
  const days = _.groupBy(items, endorsement => {
    return moment(endorsement.created_at).format("DD/MM/YY");
  });

  const daysScores = [];
  _.each(items, function (items, key) {
    const seconds = [];
    for (let i=0; i<items.length;i++) {
      if (i<items.length-1) {
        const first = moment(items[i]);
        const second = moment(items[i+1]);
        const duration = moment.duration(first.diff(second));
        seconds.push(duration.asSeconds());
      }
    }

    const averageDay = average(seconds).toFixed(2);
    let score;

    if (averageDay<1) {
      score = 99;
    } else if (averageDay<2) {
      score = 95;
    } else if (averageDay<5) {
      score = 90;
    } else if (averageDay<10) {
      score = 85;
    } else if (averageDay<25) {
      score = 80;
    } else if (averageDay<50) {
      score = 70;
    } else if (averageDay<75) {
      score = 60;
    } else if (averageDay<100) {
      score = 50;
    } else {
      score = 30;
    }

    daysScores.push(score);
  });

  return average(daysScores).toFixed(2);
}

const setBackgroundColorsFromKey = (data) => {
  const colorHash = new ColorHash({lightness: 0.75});
  _.forEach(data, item => {
    item.backgroundColor = colorHash.hex(data.key);
  });
}

const customCompress = (data) => {
  const flatData = [];

  _.forEach(data, item => {
    _.forEach(item.items,  (innerItem) => {
      innerItem.key = item.key;
      flatData.push(innerItem);
    });
  });

  const cDoneUserAgents = {};
  const cDoneEmails = {};
  const cDoneNames = {};
  const cDonePostNames = {};
  const cKeysDone = {};
  const cKeys = [];

  const outData = {
    cUserAgents: [],
    cEmails: [],
    cNames: [],
    cPostNames: [],
    items: []
  }

  _.forEach(flatData,  item => {
    if (!cKeysDone[item.key]) {
      cKeysDone[item.key] = true;
      cKeys.push(item.key);
    }

    item.key = cKeys.indexOf(item.keys);

    if (!cDoneUserAgents[item.user_agent]) {
      cDoneUserAgents[item.user_agent] = true;
      outData.cUserAgents.push(item.user_agent);
    }

    if (!cDoneEmails[item.User.email]) {
      cDoneEmails[item.User.email] = true;
      outData.cEmails.push(item.User.email);
    }

    if (!cDoneNames[item.User.name]) {
      cDoneNames[item.User.name] = true;
      outData.cNames.push(item.User.name);
    }

    if (!cDonePostNames[item.Post.name]) {
      cDonePostNames[item.Post.name] = true;
      outData.cPostNames.push(item.Post.name);
    }

    item.user_agent = outData.cUserAgents.indexOf(item.user_agent);
    item.User.email = outData.cEmails.indexOf(item.User.email);
    item.User.name = outData.cEmails.indexOf(item.User.name);
    item.Post.name = outData.cPostNames.indexOf(item.Post.name);

    outData.items.push(item);
  });

  return outData;
}

const getTopItems = (items, type) => {
  var topItems = [];
  _.each(items, function (items, key) {
    topItems.push({key: key, count: items.length, items: items });
  });

  topItems = _.sortBy(topItems, function (item) {
    return -item.count;
  });

  const postIds = [];
  _.forEach(topItems, item => {
    _.forEach(item.items,  (innerItem) => {
      postIds.push(innerItem.post_id);
    });
  });

  const postCount = _.uniq(postIds).length;

  if (type==="byIpUserAgentPostId") {
    let out = [];
    _.each(topItems, function (item) {
      if (item.count>1) {
        if ((item.count/postCount) > 10) {
          setWeightedConfidenceScore(item.items, 95);
        } else if ((item.count/postCount) > 5) {
          setWeightedConfidenceScore(item.items, 80);
        } else if ((item.count/postCount) > 2) {
          setWeightedConfidenceScore(item.items, 60);
        } else {
          setWeightedConfidenceScore(item.items, 30);
        }
        out.push(item);
      }
    });
    return out;
  } else if (type==="byIp") {
    let out = [];
    _.each(topItems, function (item) {
      if (item.count>10) {
        if ((item.count/postCount) > 100) {
          setWeightedConfidenceScore(item.items, 80);
        } else if ((item.count/postCount) > 50) {
          setWeightedConfidenceScore(item.items, 75);
        } else if ((item.count/postCount) > 25) {
          setWeightedConfidenceScore(item.items, 70);
        } else if ((item.count/postCount) > 10) {
          setWeightedConfidenceScore(item.items, 65);
        } else if ((item.count/postCount) > 5) {
          setWeightedConfidenceScore(item.items, 60);
        } else if ((item.count/postCount) > 2) {
          setWeightedConfidenceScore(item.items, 55);
        } else {
          setWeightedConfidenceScore(item.items, 45);
        }
        out.push(item);
      }
    });
    return out;
  } else {
    console.warn("Wrong type for e fraud check")
    return [];
  }
};

async function getAllEndorsements(workPackage) {
  return await new Promise(async (resolve, reject) => {
    const endorsements = await models.Endorsement.findAll({
      attributes: ["id","created_at","value","post_id","user_id","user_agent","ip_address","data"],
      include: [
        {
          model: models.User,
          attributes: ['id','name','email'],
        },
        {
          model: models.Post,
          attributes: ['id','name'],
          include: [
            {
              model: models.Group,
              attributes: ['id'],
              include: [
                {
                  model: models.Community,
                  attributes: ['id'],
                  where: {
                    id: workPackage.communityId
                  }
                }
              ]
            }
          ]
        }
      ]
    })

    const endorsementsToAnalyse = _.sortBy(endorsements, function (item) {
      return [item.post_id, item.user_agent];
    });

    resolve(endorsementsToAnalyse);
  });
}

const getTopDataByIp = (endorsements) => {
  const groupedBy = _.groupBy(endorsements, endorsement => {
    return endorsement.ip_address;
  });

  return getTopItems(groupedBy, "byIp");
}

const getTopDataByIpUserAgentPostId = (endorsements) => {
  const groupedBy = _.groupBy(endorsements, (endorsement) => {
    return endorsement.ip_address+":"+endorsement.post_id+":"+endorsement.user_agent;
  });

  return getTopItems(groupedBy, "byIpUserAgentPostId");
}

const getTopDataByNoFingerprints = (endorsements) => {
  const filtered = _.filter(endorsements, (endorsement) => {
    return endorsement.data &&
           (endorsement.data.browserFingerprint === "undefined" ||
            endorsement.data.browserId === "undefined") &&
           moment(endorsement.created_at)>moment("17/02/2022");
  });

  _.forEach(filtered,  endorsement => {
    if (endorsement.data.browserFingerprint === "undefined" &
       endorsement.data.browserId === "undefined") {
      endorsement.confidenceScore = 100;
      endorsement.key = "bothUndefined";
    } else if (endorsement.data.browserId === "undefined") {
      endorsement.confidenceScore = 90;
      endorsement.key = "browserIdUndefined";
    } else {
      endorsement.confidenceScore = 75;
      endorsement.key = "fingerPrintUndefined";
    }
  })

  return filtered;
}

const deleteJob = async (workPackage, done) => {
  try {
    await models.AcBackgroundJob.destroyJobAsync(workPackage.jobId);
    done();
  } catch (error) {
    done(error);
  }
}

const getData = async (workPackage, done) => {
  try {
    await models.AcBackgroundJob.updateProgressAsync(workPackage.jobId, 10);
    const endorsements = await getAllEndorsements(workPackage);
    await models.AcBackgroundJob.updateProgressAsync(workPackage.jobId, 75);

    let data;

    if (workPackage.type==="get-by-ip-address") {
      data = getTopDataByIp(endorsements);
    } else if (workPackage.type==="get-by-ip-address-user-agent-post-id") {
      data = getTopDataByIpUserAgentPostId(endorsements);
    } else if (workPackage.type==="get-by-missing-fingerprint") {
      data = getTopDataByNoFingerprints(endorsements);
    }

    setBackgroundColorsFromKey(data);
    data = customCompress(data);

    await models.AcBackgroundJob.updateDataAsync(workPackage.jobId, data);
    await models.AcBackgroundJob.updateProgressAsync(workPackage.jobId, 100);
    done();
  } catch (error) {
    console.error(error);
    done(error);
  }
}

module.exports = {
  getData,
  deleteJob
};