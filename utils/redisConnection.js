const redis = require("redis");
let redisClient;

if (process.env.REDIS_URL) {
  let redisUrl = process.env.REDIS_URL;

  if (redisUrl.startsWith("redis://h:")) {
    redisUrl = redisUrl.replace("redis://h:","redis://:")
  }

  if (redisUrl.includes("rediss://")) {
    redisClient = redis.createClient(redisUrl, { tls: { rejectUnauthorized: false } });
  } else {
    redisClient = redis.createClient(redisUrl);
  }

} else {
  redisClient = redis.createClient();
}

module.exports = redisClient;