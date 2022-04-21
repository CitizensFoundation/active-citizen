const models = require("../../../../models");
const _ = require("lodash");
const log = require("../../../utils/logger");
const request = require("request");

const getFromAnalyticsApi = (
  req,
  featureType,
  collectionType,
  collectionId,
  done
) => {
  const options = {
    url:
      process.env["PLAUSIBLE_BASE_URL"] +
      featureType +
      "/" +
      collectionType +
      "/" +
      process.env.AC_ANALYTICS_CLUSTER_ID +
      "/" +
      collectionId,
    headers: {
      "X-API-KEY": process.env["PLAUSIBLE_API_KEY"],
    },
  };

  request.get(options, (error, content) => {
    if (content && content.statusCode != 200) {
      error = content.statusCode;
    } else {
      //resolve()
    }
    done(error, content);
  });
};

async function createPlausibleSite(community) {
  return await new Promise((resolve, reject) => {
    if (process.env["PLAUSIBLE_BASE_URL"] &&
      process.env["PLAUSIBLE_API_KEY"]) {
      const options = {
        url:
          process.env["PLAUSIBLE_BASE_URL"] +
          "sites/",
        headers: {
          "authorization": `Bearer ${process.env["PLAUSIBLE_API_KEY"]}`,
        },
        json: {
          domain: `community_${community.id}`,
          timezone: 'Europe/London'
        },
      };

      request.post(options, (error, content) => {
        if (content && content.statusCode != 200) {
          log.error(error);
          log.error(content);
          reject(content.statusCode);
        } else {
          resolve();
        }
      });
    } else {
      log.warn("No plausible base url or api key");
      resolve();
    }
  });
}

module.exports = {
  createPlausibleSite
};
