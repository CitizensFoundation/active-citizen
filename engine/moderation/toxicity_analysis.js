const queue = require('../../workers/queue');
const models = require("../../../models");
const i18n = require('../../utils/i18n');
const async = require('async');
const moment = require('moment');
const log = require('../../utils/logger');
const _ = require('lodash');

const Perspective = require('perspective-api-client');
const perspective = new Perspective({apiKey: process.env.GOOGLE_PERSPECTIVE_API_KEY});

log.info("Starting");

(async () => {
  const text = 'you empty-headed animal food trough wiper!';
  const result = await perspective.analyze(text);
  log.info(JSON.stringify(result, null, 2));
})();

