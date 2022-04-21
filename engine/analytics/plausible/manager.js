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


async function getPlausibleStats(statsParams) {
  return await new Promise((resolve, reject) => {
    if (process.env["PLAUSIBLE_BASE_URL"] &&
      process.env["PLAUSIBLE_API_KEY"]) {
      const options = {
        url:
          process.env["PLAUSIBLE_EVENT_BASE_URL"] +
          "stats/timeseries?site_id=your-priorities&period=6mo",
        headers: {
          "Authorization": `Bearer ${process.env["PLAUSIBLE_API_KEY"]}`,
          "X-Forwarded-For": "127.0.0.1",
          "Content-Type": "application/json"
        }
      };

      log.info(JSON.stringify(options))

      request.get(options, (error, content) => {
        if (content && content.statusCode != 202) {
          log.error(error);
          log.error(content);
          reject(content.statusCode);
        } else {
          console.log(content);
          resolve();
        }
      });
    } else {
      log.warn("No plausible base url or api key");
      resolve();
    }
  });
}

async function addPlausibleEvent(eventName, userAgent, url, domain, screenWidth) {
  return await new Promise((resolve, reject) => {
    if (process.env["PLAUSIBLE_EVENT_BASE_URL"] &&
      process.env["PLAUSIBLE_API_KEY"]) {
      const options = {
        url:
          process.env["PLAUSIBLE_EVENT_BASE_URL"] +
          "event/",
        headers: {
//          "Authorization": `Bearer ${process.env["PLAUSIBLE_API_KEY"]}`,
          "X-Forwarded-For": "127.0.0.1",
          "User-Agent": userAgent,
          "Content-Type": "application/json"
        },
        method: 'POST',
        json: {
          name: eventName,
          url,
          domain: "your-priorities",
          screen_width: screenWidth
        },
      };

      log.info(JSON.stringify(options))

      request.post(options, async (error, content) => {
        if (content && content.statusCode != 202) {
          log.error(error);
          log.error(content);
          reject(content.statusCode);
        } else {
          await getPlausibleStats()
          resolve();
        }
      });
    } else {
      log.warn("No plausible base url or api key");
      resolve();
    }
  });
}

async function createPlausibleSite(community) {
  return await new Promise((resolve, reject) => {
    if (process.env["PLAUSIBLE_BASE_URL"] &&
      process.env["PLAUSIBLE_API_KEY"]) {
      const options = {
        url:
          process.env["PLAUSIBLE_BASE_URL"] +
          "sites/",
        headers: {
          "Authorization": `Bearer ${process.env["PLAUSIBLE_API_KEY"]}`,
          "X-Forwarded-For": "127.0.0.1",
          "Content-Type": "multipart/form-data"
        },
        formData: {
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
  createPlausibleSite,
  addPlausibleEvent
};
