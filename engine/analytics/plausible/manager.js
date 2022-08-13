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
    if (process.env["PLAUSIBLE_BASE_URL"] && process.env["PLAUSIBLE_API_KEY"]) {
      const options = {
        url: process.env["PLAUSIBLE_BASE_URL"] + "stats/" + statsParams,
        headers: {
          "Authorization": `Bearer ${process.env["PLAUSIBLE_API_KEY"]}`,
          "X-Forwarded-For": "127.0.0.1",
          "Content-Type": "application/json",
        },
      };

      log.info(JSON.stringify(options));

      request.get(options, (error, content) => {
        if (content && content.statusCode != 200) {
          log.error(error);
          log.error(content);
          reject(content.statusCode);
        } else {
          console.log(content.body);
          resolve(content.body);
        }
      });
    } else {
      log.warn("No plausible base url or api key");
      resolve();
    }
  });
}

async function addPlausibleEvent(
  eventName,
  userAgent,
  url,
  workData,
  screenWidth,
  referrer,
  ipAddress
) {
  return await new Promise(async (resolve, reject) => {
    if (
      process.env["PLAUSIBLE_EVENT_BASE_URL"] &&
      process.env["PLAUSIBLE_API_KEY"]
    ) {

      let communityId;

      try {
        if (!communityId && workData.groupId) {
          const group = await models.Group.findOne({
            where: {
              id: workData.groupId
            },
            attributes: ['community_id']
          });

          if (group) {
            communityId = group.community_id
          }
        }

        if (!communityId && workData.postId) {
          const post = await models.Post.findOne({
            where: {
              id: workData.postId
            },
            attributes: ['id'],
            include: [
              {
                model: models.Group,
                attributes: ['community_id'],
                required: true
              }
            ]
          });

          if (post) {
            communityId = post.Group.community_id
          }
        }

        if (!communityId && workData.communityId) {
          communityId = workData.communityId;
        }

        if (!workData.groupId && workData.postId) {
          const post = await models.Post.findOne({
            where: {
              id: workData.postId
            },
            attributes: ['group_id']
          });

          if (post) {
            workData.groupId = post.group_id
          }
        }
      } catch (error) {
        reject(error);
        return;
      }

      const props = {
        communityId: communityId ? parseInt(communityId) : undefined,
        groupId: workData.groupId ? parseInt(workData.groupId) : undefined,
        domainId: workData.domainId ? parseInt(workData.domainId) : undefined,
        postId: workData.postId ? parseInt(workData.postId) : undefined,
        pointId: workData.pointId ? parseInt(workData.pointId) : undefined,
        userId: workData.userId ? parseInt(workData.userId) : -1,
      };

      const options = {
        url: process.env["PLAUSIBLE_EVENT_BASE_URL"] + "event/",
        headers: {
          "X-Forwarded-For": ipAddress,
          "User-Agent": userAgent,
          "Content-Type": "application/json",
        },
        method: "POST",
        json: {
          name: eventName,
          url,
          domain: process.env["PLAUSIBLE_SITE_NAME"],
          screen_width: screenWidth,
          referrer,
          props: JSON.stringify(props)
        },
      };

      //log.info(JSON.stringify(options));
      log.debug(`Plausible ${eventName} - ${JSON.stringify(props)}`);

      request.post(options, async (error, content) => {
        if (content && content.statusCode != 202) {
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
  addPlausibleEvent,
  getPlausibleStats,
};
