const _ = require("lodash");
const moment = require("moment");

class FraudBase {
  constructor(workPackage) {
    this.workPackage = workPackage;
    this.items = null;
  }

  getStartFingerprintMoment()  {
    if (this.workPackage.collectionType==="endorsements") {
      return moment("16/02/2022","DD/MM/YYYY").valueOf();
    } else {
      return moment("21/02/2022","DD/MM/YYYY").valueOf();
    }
  }

  groupTopDataByIp()  {
    return _.groupBy(this.items, item => {
      return item.ip_address;
    });
  }

  groupTopDataByIpUserAgentPostId()  {
    return _.groupBy(this.items, (item) => {
      return item.ip_address+":"+item.post_id+":"+item.user_agent;
    });
  }

  groupTopDataByIpFingerprintPostId() {
    const filtered = _.filter(this.items, (item) => {
      return item.data &&
             item.data.browserFingerprint &&
             item.data.browserFingerprint !== "undefined";
    });

    return _.groupBy(filtered, (item) => {
      return item.ip_address+":"+item.post_id+":"+item.data.browserFingerprint;
    });
  }

  groupTopDataByIpFingerprint()  {
    const filtered = _.filter(this.items, (item) => {
      return item.data &&
             item.data.browserFingerprint &&
             item.data.browserFingerprint !== "undefined";
    });

    return _.groupBy(filtered, (item) => {
      return item.ip_address+":"+item.data.browserFingerprint;
    });
  }

  groupTopDataByNoFingerprints() {
    const filtered = _.filter(this.items, item => {
      return item.data &&
             (!item.data.browserFingerprint ||
              !item.data.browserId) &&
              moment(item.created_at).valueOf()>this.getStartFingerprintMoment();
    });

    _.forEach(filtered,  item => {
      if (!item.data.browserFingerprint &&
        !item.data.browserId) {
        item.dataValues.confidenceScore = "100%";
        item.dataValues.key = "bothUndefined";
      } else if (!item.data.browserId) {
        item.dataValues.confidenceScore = "90%";
        item.dataValues.key = "browserIdUndefined";
      } else {
        item.dataValues.confidenceScore = "75%";
        item.dataValues.key = "fingerPrintUndefined";
      }
    })

    return _.groupBy(filtered, item => {
      return item.key;
    });
  }
}

module.exports = FraudBase;