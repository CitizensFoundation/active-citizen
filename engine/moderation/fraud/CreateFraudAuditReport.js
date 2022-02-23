const models = require("../../../../models");
const i18n = require("../../../utils/i18n");
const async = require("async");
const moment = require("moment");
const log = require("../../../utils/logger");
const _ = require("lodash");
const fs = require("fs");
const Excel = require("exceljs");

const setJobError = require("../../reports/common_utils").setJobError;
const uploadToS3 = require("../../reports/common_utils").uploadToS3;

const sanitizeFilename = require("sanitize-filename");

const formatWorksheet = (worksheet) => {
  worksheet.getRow(1).font = { bold: true };
  //  worksheet.properties.defaultRowHeight = 20;
};

class FraudAuditReport {
  constructor(workPackage) {
    this.workPackage = workPackage;
    this.exportedData = null;
    this.items = null;
    this.workBook = null;
    this.worksheet = null;
  }

  async setupXls() {
    const originalWorkPackage = this.workPackage.auditReportData.workPackage;
    this.workBook = new Excel.Workbook();

    this.workBook.creator = "Your Priorities Report - Automated";
    this.workBook.created = new Date();

    this.worksheet = this.workBook.addWorksheet(`Community Users ${community.id} ${this.workPackage.userName}`);

    this.worksheet.columns = [
      { header: "Method", key: "selectedMethod", width: 20 },
      { header: "Date deleted", key: "dateDeleted", width: 20 },
      { header: "Id", key: "id", width: 10 },
      { header: "Date created", key: "date", width: 20 },
      { header: "IP Address", key: "ipAddress", width: 20 },
      { header: "Browser Id", key: "browerId", width: 30 },
      { header: "Fingerprint", key: "browserFingerprint", width: 30 },
      { header: "User Id", key: "userId", width: 15 },
      { header: "Email", key: "email", width: 40 }
    ];

    if (['posts','pointQualities'].indexOf(originalWorkPackage.collectionType) === -1) {
      this.worksheet.columns = this.worksheet.columns.concat([
        { header: "Post Id", key: "postId", width: 20 },
        { header: "Post Name", key: "postName", width: 30 },
      ])
    }

    if (['endorsements','pointQualities','ratings'].indexOf(originalWorkPackage.collectionType) !== -1) {
      this.worksheet.columns = this.worksheet.columns.concat([
        { header: "Value", key: "value", width: 20 }
      ])
    }

    if (['pointQualities'].indexOf(originalWorkPackage.collectionType) !== -1) {
      this.worksheet.columns = this.worksheet.columns.concat([
        { header: "Point Id", key: "postId", width: 20 },
      ])
    }

    this.worksheet.columns = this.worksheet.columns.concat([
      { header: "User Agent", key: "userAgent", width: 50 }
    ])
  }

  setupFilename() {
    const dateString = moment(new Date()).format("DD_MM_YY_HH_mm");
    const communityName = sanitizeFilename(this.workPackage.community.name).replace(/ /g, "");

    this.workPackage.filename =
      "Community_Users_Export_" +
      this.workPackage.communityId +
      "_" +
      communityName +
      "_" +
      dateString +
      ".xls";

    this.workPackage.fileEnding = "xls";
  }

  async getCommunity() {
    this.workPackage.community = await models.Community({
      where: {
        id: this.workPackage.communityId
      },
      attributes: ['id','name','data']
    });
  }

  async uploadToS3() {
    return await new Promise(async (resolve, reject) => {
      uploadToS3(
        this.workPackage.jobId,
        this.workPackage.userId,
        this.workPackage.filename,
        this.workPackage.fileEnding,
        this.exportedData,
        (error, reportUrl) => {
          if (error) {
            reject(error);
          } else {
            models.AcBackgroundJob.update(
              {
                progress: 100,
                data: { reportUrl },
              },
              {
                where: { id: this.workPackage.jobId },
              }
            )
              .then(() => {
                resolve();
              })
              .catch((error) => {
                reject(error);
              });
          }
        }
      );
    });
  }

  async setupItems() {
    const auditReportData = this.workPackage.auditReportData;

    switch (auditReportData.workPackage.collectionType) {
      case 'endorsements':
        this.items = await this.getEndorsementItems(auditReportData.deleteData.idsToDelete);
        break;
      case 'ratings':
        this.items = await this.getRatingItems(auditReportData.deleteData.idsToDelete);
        break;
      case 'pointQualities':
        this.items = await this.getPointQualityItems(auditReportData.deleteData.idsToDelete);
        break;
      case 'points':
        this.items = await this.getPointItems(auditReportData.deleteData.idsToDelete);
        break;
      case 'posts':
        this.items = await this.getPostItems(auditReportData.deleteData.idsToDelete);
        break;
    }
  }

  async populateXls() {
    const originalWorkPackage = this.workPackage.auditReportData.workPackage;
    for (let i=0;i<this.items.length;i++) {
      const item = items[i];
      let row = {
        method: originalWorkPackage.selectedMethod,
        dateDeleted: this.workPackage.auditReportData.date,
        id: item.id,
        date: item.created_at,
        userId: item.User.id,
        email: item.User.email,
        ipAddress: item.ip_address,
        userAgent: item.user_agent,
      }

      if (item.data) {
        row.browserFingerpint = item.data.browserFingerpint;
        row.browserId = item.data.browserId;
      }

      if (['posts','pointQualities'].indexOf(originalWorkPackage.collectionType) === -1) {
        row.postId = item.Post.id;
        row.postName = item.Post.name;
      }

      if (['endorsements','pointQualities','ratings'].indexOf(originalWorkPackage.collectionType) !== -1) {
        row.value = item.value;
      }

      if (['pointQualities'].indexOf(originalWorkPackage.collectionType) !== -1) {
        row.pointId = item.Point.id;
      }

      this.worksheet.addRow(row);
    }

    this.exportedData = await workbook.xlsx.writeBuffer();
  }

  async createReport() {
    return await new Promise(async (resolve, reject) => {
      try {
        const auditReport = await models.GeneralDataStore.findOne({
          id: this.workPackage.selectedFraudAuditId
        });

        if (auditReport && auditReport.data) {
          this.workPackage.auditReportData = auditReport.data;
           await this.getCommunity();
          this.setupFilename();

          await models.AcBackgroundJob.updateProgressAsync(this.workPackage.jobId, 5);

          await this.setupItems();

          await models.AcBackgroundJob.updateProgressAsync(this.workPackage.jobId, 70);

          await this.setupXls();

          await this.populateXls();

          await models.AcBackgroundJob.updateProgressAsync(this.workPackage.jobId, 90);

          await this.uploadToS3();

          resolve();
        } else {
          reject(`No fraud audit found for ${this.workPackage.selectedFraudAuditId}`)
        }
      } catch (error) {
        console.error(error);
        setJobError(
          this.workPackage.jobId,
          "errorXlsCommunityUsersReportGeneration",
          error,
          (dbError) => {
            reject(dbError || error);
          }
        );
      }
    })
  }
}

const createFraudAuditReport = async (workPackage, done) => {
  const generator = new FraudAuditReport(workPackage);
  await generator.createReport();
  done();
}

module.exports = {
  createFraudAuditReport
};
