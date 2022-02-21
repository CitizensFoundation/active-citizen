const _ = require("lodash");
const moment = require("moment");

const FraudBase = require('./FraudBase');
const models = require("../../../../models");
const ColorHash = require('color-hash').default;

const average = arr => arr.reduce((a,b) => a + b, 0) / arr.length;

class FraudGetBase extends FraudBase {
  constructor(workPackage){
    super(workPackage);
    this.dataOut = null;
  }

  async getAllItems() {
    console.error("Should be implemented in a sub class");
    return null;
  }

  getTopItems() {
    console.error("Should be implemented in a sub class");
    return null;
  }

  getTimeDifferentScores (items) {
    const days = _.groupBy(items, item => {
      return moment(item.created_at).format("DD/MM/YY");
    });

    const daysScores = [];
    _.each(days, function (innerItems, key) {
      const seconds = [];
      const sortedItems = _.sortBy(innerItems, item => {
        return moment(item.created_at).valueOf()
      })

      for (let i=0; i<sortedItems.length;i++) {
        if (i<sortedItems.length-1) {
          const first = moment(sortedItems[i].created_at);
          const second = moment(sortedItems[i+1].created_at);
          const duration = moment.duration(second.diff(first));
          seconds.push(Math.round(duration.asSeconds()));
        }
      }

      const averageDay = average(seconds);
      let score;

      if (averageDay<1) {
        score = 99;
      } else if (averageDay<5) {
        score = 97;
      } else if (averageDay<50) {
        score = 95;
      } else if (averageDay<100) {
        score = 90;
      } else if (averageDay<200) {
        score = 85;
      } else if (averageDay<400) {
        score = 80;
      } else if (averageDay<800) {
        score = 75;
      } else if (averageDay<900) {
        score = 60;
      } else {
        score = 50;
      }

      daysScores.push(score);
    });

    return average(daysScores);
  }

  setWeightedConfidenceScore (items, score) {
    const timeScore = this.getTimeDifferentScores(items);
    const averageScore = (timeScore+score)/2;
    //TODO: Use native for

    for (let i=0;i<items.length;i++) {
      const item = items[i];
      const hasData = item.data ? Object.keys(item.data).length === 0 : false;
      if (hasData && !item.data.browserId && moment(item.created_at)>this.getStartFingerprintMoment()) {
        item.dataValues.confidenceScore = `100%`;
      } else {
        item.dataValues.confidenceScore = `${averageScore.toFixed(0)}%`;
      }
    }
  }

  getTopDataByIp()  {
    return this.getTopItems(this.groupTopDataByIp(), "byIpAddress");
  }

  getTopDataByIpUserAgentPostId() {
    return this.getTopItems(this.groupTopDataByIpUserAgentPostId(), "byIpUserAgentPostId");
  }

   getTopDataByIpFingerprintPostId ()  {
    return this.getTopItems(this.groupTopDataByIpFingerprintPostId(), "byIpFingerprintPostId");
  }

  getTopDataByIpFingerprint () {
    return this.getTopItems(this.groupTopDataByIpFingerprint(), "byIpFingerprint");
  }

  getTopDataByNoFingerprints ()  {
    return this.getTopItems(this.groupTopDataByNoFingerprints(), "byMissingFingerprint");
  }

  formatTime()  {
    _.forEach(this.dataOut, item => {
      for (let i=0;i<item.items.length;i++) {
        item.items[i].dataValues.createAtValue = moment( item.items[i].created_at).valueOf();
        item.items[i].dataValues.created_at = moment( item.items[i].created_at).format("DD/MM/YY HH:mm:ss");
      }
    });
  }

  setBackgroundColorsFromKey ()  {
    const colorHash = new ColorHash({lightness: 0.83});
    _.forEach(this.dataOut, item => {
      const color = colorHash.hex(item.key);
      for (let i=0;i<item.items.length;i++) {
        item.items[i].dataValues.backgroundColor = color;
      }
    });
  }

  customCompress() {
    const flatData = [];

    _.forEach(this.dataOut, item => {
      for (let i=0;i<item.items.length;i++) {
        const innerItem = item.items[i];
        innerItem.key = item.key;
        innerItem.dataValues.groupCount = item.items.length;
        flatData.push(innerItem);
      }
    });

    const cDoneBackgroundColors = {};
    const cDoneIpAddresses = {};
    const cDoneUserAgents = {};
    const cDoneEmails = {};
    const cDoneNames = {};
    const cDonePostNames = {};
    const cKeysDone = {};
    const cKeys = [];

    const outData = {
      cBackgroundColors: [],
      cIpAddresses: [],
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

      item.dataValues.key = cKeys.indexOf(item.key);

      if (!cDoneBackgroundColors[item.dataValues.backgroundColor]) {
        cDoneBackgroundColors[item.dataValues.backgroundColor] = true;
        outData.cBackgroundColors.push(item.dataValues.backgroundColor);
      }

      if (!cDoneIpAddresses[item.ip_address]) {
        cDoneIpAddresses[item.ip_address] = true;
        outData.cIpAddresses.push(item.ip_address);
      }

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

      item.dataValues.backgroundColor = outData.cBackgroundColors.indexOf(item.dataValues.backgroundColor);
      item.dataValues.confidenceScoreSort = parseInt(item.dataValues.confidenceScore.replace("%",''));
      item.ip_address = outData.cIpAddresses.indexOf(item.ip_address);
      item.user_agent = outData.cUserAgents.indexOf(item.user_agent);
      item.User.email = outData.cEmails.indexOf(item.User.email);
      item.User.name = outData.cEmails.indexOf(item.User.name);
      item.Post.name = outData.cPostNames.indexOf(item.Post.name);

      outData.items.push(item);
    });

    this.dataOut = outData;
  }

  getPostIdsFromItems(topItems) {
    const postIds = [];
    _.forEach(topItems, item => {
      for (let i=0;i<item.items.length;i++) {
        postIds.push(item.items[i].post_id);
      }
    });

    return postIds;
  }

  setupTopItems(items) {
    let topItems = [];

    _.each(items, function (items, key) {
      topItems.push({key: key, count: items.length, items: items });
    });

    return _.sortBy(topItems, function (item) {
      return -item.count;
    });
  }

  async processAndGetFraudItems() {
    console.log(`Get Fraud ${JSON.stringify(this.workPackage)}`);

    this.items = await this.getAllItems();

    switch (this.workPackage.selectedMethod) {
      case "byIpAddress":
        this.dataOut = this.getTopDataByIp();
        break;
      case "byIpUserAgentPostId":
        this.dataOut = this.getTopDataByIpUserAgentPostId();
        break;
      case "byIpFingerprintPostId":
        this.dataOut = this.getTopDataByIpFingerprintPostId();
        break;
      case "byIpFingerprint":
        this.dataOut = this.getTopDataByIpFingerprint();
        break;
      case "byMissingBrowserFingerprint":
        this.dataOut = this.getTopDataByNoFingerprints();
        break;
    }

    this.setBackgroundColorsFromKey();
    this.formatTime();
    this.customCompress();

    await models.AcBackgroundJob.updateDataAsync(this.workPackage.jobId, this.dataOut);
    await models.AcBackgroundJob.updateProgressAsync(this.workPackage.jobId, 100);
  }
}

module.exports = FraudGetBase;