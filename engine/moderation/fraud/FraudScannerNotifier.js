const _ = require("lodash");
const moment = require("moment");
const models = require("../../../../models");
const i18n = require('../../../utils/i18n');

const FraudGetEndorsements = require("./FraudGetEndorsements");
const FraudGetPointQualities = require("./FraudGetPointQualities");
const FraudGetRatings = require("./FraudGetRatings");
const queue = require("../../../workers/queue");
const Backend = require("i18next-node-fs-backend");
const path = require("path");

var localesPath = path.resolve(__dirname, '../../../locales');

class FraudScannerNotifier {
  constructor() {
    this.currentCommunity = null;
    this.uniqueCollectionItemsIds = {};
    this.collectionsToScan = ['endorsements', 'ratings','pointQualities'];
    this.scannerModels = [FraudGetEndorsements, FraudGetRatings, FraudGetPointQualities];
  }

  getCommunityURL () {
    const domainName = this.currentCommunity.Domain.domain_name;
    let hostname = this.currentCommunity.hostname;
    const id = this.currentCommunity.id;

    if (domainName==="parliament.scot") {
      hostname = "engage";
    } else if (domainName==="multicitychallenge.org" && process.env('US-CLUSTER')!=null) {
      hostname = "ideas";
    } else if (domainName==="multicitychallenge.org") {
      hostname = "yp";
    }

    if (hostname) {
      return `https://${hostname}.${domainName}/community/${id}`;
    } else {
      return `https://${domainName}/community/${id}`;
    }
  }

  setupCounts(items, collectionType) {
    if (!this.uniqueCollectionItemsIds[collectionType]) {
      this.uniqueCollectionItemsIds[collectionType]=[];
    }

    if (items) {
      for (let i=0;i<items.length;i++)  {
        if (this.uniqueCollectionItemsIds[collectionType].indexOf(items[i].id) === -1) {
          const confidenceScore = parseInt(items[i].confidenceScore.replace("%",""));
          if (confidenceScore>75) {
            this.uniqueCollectionItemsIds[collectionType].push(items[i].id);
          }
        }
      }
    } else {
      console.error(`No job data for ${collectionType}`);
    }
  }

  capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  formatNumber(value) {
    if (value) {
      return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    } else {
      return "0";
    }
  }

  async sendNotificationEmails(texts) {
    const admins = this.currentCommunity.CommunityAdmins;
    let textsHtml = "";
    for (let t=0;t<texts.length;t++) {
      textsHtml += `${this.formatNumber(texts[t])} items</br>`
    }

    const content = `
      <div>
        <h1>${i18n.t('notification.email.possibleFraudHeader')}</h1>
        <p>${i18n.t('notification.email.possibleFraudInformation')}</p>
        <h2>${i18n.t('notification.email.possibleFraudSubHeader')}</h2>
        <p>${textsHtml}</p>
        <p>${i18n.t('notification.email.possibleFraudFooter')}</p>
      </div>
    `

    for (let u=0;u<admins.length;u++) {
      queue.create('send-one-email', {
        subject: { translateToken: 'notification.email.possibleFraudHeader', contentName: this.currentCommunity.name },
        template: 'general_user_notification',
        user: admins[u],
        domain: this.currentCommunity.Domain,
        community: this.currentCommunity,
        object: texts,
        header: "",
        content: content,
        link: this.getCommunityURL()
      }).priority('high').removeOnComplete(true).save();
    }

  }

  async notify() {
    const collectionCountTexts = [];

    for (let c=0;c<this.collectionsToScan.length;c++) {
      const collectionLength = this.uniqueCollectionItemsIds[this.collectionsToScan[c]].length;
      if (collectionLength>10) {
        collectionCountTexts.push(`${this.capitalizeFirstLetter(this.collectionsToScan[c])}: ${collectionLength}`)
      }
    }

    if (collectionCountTexts.length>0) {
      await this.currentCommunity.reload();

      if (!this.currentCommunity.data ||
          !this.currentCommunity.data.lastFraudScanResults ||
          JSON.stringify(this.currentCommunity.data.lastFraudScanResults) !== JSON.stringify(collectionCountTexts)
      ) {
        await this.sendNotificationEmails(collectionCountTexts);

        if (!this.currentCommunity.data) {
          this.currentCommunity.data = {};
        }

        this.currentCommunity.data.lastFraudScanResults = collectionCountTexts;
        this.currentCommunity.changed('data', true);

        await this.currentCommunity.save();
      } else {
        console.log("Not resending same numbers");
      }
    }
  }

  async scan() {
    for (let c=0;c<this.collectionsToScan.length;c++) {
      let methodsToScan = ['byIpFingerprint','byMissingBrowserFingerprint','byIpAddress'];

      if (this.collectionsToScan[c]==="pointQualities") {
        methodsToScan = methodsToScan.concat(['byIpFingerprintPointId', 'byIpUserAgentPointId']);
      } else {
        methodsToScan = methodsToScan.concat(['byIpFingerprintPostId', 'byIpUserAgentPostId']);
      }

      for (let m=0;m<methodsToScan.length;m++) {
        let job = await models.AcBackgroundJob.createJobAsync({},{});
        const workPackage = {
          userId: -1,
          communityId: this.currentCommunity.id,
          jobId: job.id,
          collectionType: this.collectionsToScan[c],
          selectedMethod: methodsToScan[m]
        }

        const scanner = new this.scannerModels[c](workPackage);
        await scanner.processAndGetFraudItems();
        job = await job.reload();
        this.setupCounts(job.data.items, this.collectionsToScan[c]);
        await job.destroy();
      }
    }
  }

  async scanAndNotify() {
    return await new Promise(async (resolve, reject) => {
      try {
        const communities = await models.Community.findAll({
          where: {
            "configuration.enableFraudDetection": true
          },
          attributes: ['id','configuration','name','data','hostname'],
          include: [
            {
              model: models.Domain,
              attributes: ['id','name','domain_name']
            },
            {
              model: models.User,
              as: 'CommunityAdmins',
              attributes: ['id','email','name']
            }
          ]
        });

        for (let i=0;i<communities.length;i++) {
          console.log("Processing community: "+communities[i].name);
          this.currentCommunity = communities[i];
          await this.scan();
          await this.notify();
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    })
  }
}

i18n
  .use(Backend)
  .init({
    preload: ['en', 'fr', 'sk','bg', 'cs','it','da', 'kl', 'es', 'sv', 'sq','uz','uk', 'ca', 'hr','ro','ru',
      'ro_MD','pt_BR', 'hu', 'tr', 'is', 'nl','no', 'pl', 'zh_TW','ky'],

    fallbackLng:'en',

    // this is the defaults
    backend: {
      // path where resources get loaded from
      loadPath: localesPath+'/{{lng}}/translation.json',

      // path to post missing resources
      addPath: localesPath+'/{{lng}}/translation.missing.json',

      // jsonIndent to use when storing json files
      jsonIndent: 2
    }
  }, function (err, t) {
    (async () => {
      try {
        const scanner = new FraudScannerNotifier();
        await scanner.scanAndNotify();
        console.log("Fraud Scanning Complete");
        process.exit();
      } catch (error) {
        console.error(error);
        process.exit();
      }
    })();
  }
)

