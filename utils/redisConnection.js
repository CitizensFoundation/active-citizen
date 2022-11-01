const redis = require("redis");
let redisClient;
if (process.env.REDIS_URL) {
  let redisUrl = process.env.REDIS_URL;

  if (redisUrl.startsWith("redis://h:")) {
    redisUrl = redisUrl.replace("redis://h:", "redis://:");
  }

  if (redisUrl.includes("rediss://")) {
    redisClient = redis.createClient({
      legacyMode: true,
      url: redisUrl,
      socket: { tls: true, rejectUnauthorized: false },
    });
  } else {
    redisClient = redis.createClient({ legacyMode: true, url: redisUrl});
  }
} else {
  redisClient = redis.createClient({ legacyMode: true });
}

redisClient.connect().catch(console.error);

module.exports = redisClient;
