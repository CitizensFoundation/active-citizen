const models = require('../../../../models');
const _ = require('lodash');
const async = require('async');
const log = require('../../../../utils/logger');
const updateCollection = require('./aiAssistantClient').updateCollection;

if (process.env["AC_AI_ASSISTANT_KEY"] && process.env["AC_AI_ASSISTANT_BASE_URL"] ) {
  updateCollection({
    postId: 71592
  }, (error, result) => {
    if (error) {
      console.error(error);
    } else {
      console.log(result);
    }
    process.exit();
  });
} else {
  console.error("NO AC_AI_ASSISTANT_KEY");
  process.exit();
}
