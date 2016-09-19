// https://gist.github.com/mojodna/1251812

var EmailWorker = function () {};

var log = require('../utils/logger');
var path = require('path');
var EmailTemplate = require('email-templates').EmailTemplate;
var nodemailer = require('nodemailer');
var ejs = require('ejs');
var i18n = require('../utils/i18n');
var toJson = require('../utils/to_json');
var airbrake = require('../utils/airbrake');
var async = require('async');

var templatesDir = path.resolve(__dirname, '..', 'email_templates', 'notifications');

var i18nFilter = function(text) {
  return i18n.t(text);
};

var transport = nodemailer.createTransport({
  service: 'sendgrid',
  auth: {
    user: process.env.SENDGRID_USERNAME,
    pass: process.env.SENDGRID_PASSWORD
  }
});

var translateSubject = function (subjectHash) {
  var subject = i18n.t(subjectHash.translateToken);
  if (subjectHash.contentName) {
    subject += ": "+subjectHash.contentName
  }
  return subject;
};

var linkTo = function (url) {
  return '<a href="'+url+'">'+url+'</a>';
};

EmailWorker.prototype.sendOne = function (emailLocals, callback) {
  log.info("EmailWorker Started 1", {});
  async.series([
    function (seriesCallback) {
      log.info("EmailWorker Started 2", {});
      var template = new EmailTemplate(path.join(templatesDir, emailLocals.template));

      emailLocals['t'] = i18nFilter;

      emailLocals['linkTo'] = linkTo;

      if (!emailLocals['community']) {
        emailLocals['community'] = { hostname: 'www' }
      }

      var fromEmail;

      if (emailLocals.domain && emailLocals.domain.domain_name) {
        if (emailLocals.domain.domain_name.indexOf('betrireykjavik.is') > -1) {
          fromEmail = 'betrireykjavik@ibuar.is';
        } else if (emailLocals.domain.domain_name.indexOf('betraisland.is') > -1) {
          fromEmail = 'betraisland@ibuar.is';
        } else {
          fromEmail = "admin@yrpri.org";
        }

        var locale;

        if (emailLocals.user.default_locale && emailLocals.user.default_locale != "") {
          locale = emailLocals.user.default_locale;
        } else if (emailLocals.community && emailLocals.community.default_locale && emailLocals.community.default_locale != "") {
          locale = emailLocals.community.default_locale;
        } else if (emailLocals.domain && emailLocals.domain.default_locale && emailLocals.domain.default_locale != "") {
          locale = emailLocals.domain.default_locale;
        } else {
          locale = 'en';
        }

        emailLocals.headerImageUrl = "";

        log.info("EmailWorker Selected locale", { locale: locale });

        i18n.changeLanguage(locale, function (err, t) {
          var translatedSubject = translateSubject(emailLocals.subject);
          template.render(emailLocals, function (error, results) {
            if (error) {
              log.error('EmailWorker Error', { err: error, userID: emailLocals.user.id });
              seriesCallback(error);
            } else {
              if (process.env.SENDGRID_USERNAME) {
                transport.sendMail({
                  from: fromEmail, // emailLocals.community.admin_email,
                  to: emailLocals.user.email,
                  bcc: 'gunnar@ibuar.is,robert@citizens.is',
                  subject: translatedSubject,
                  html: results.html,
                  text: results.text
                }, function (error, responseStatus) {
                  if (error) {
                    log.error('EmailWorker', { err: error, user: emailLocals.user });
                    seriesCallback(error);
                  } else {
                    log.info('EmailWorker Completed', { responseStatusMessage: responseStatus.message, email: emailLocals.user.email, userId: emailLocals.user.id });
                    seriesCallback();
                  }
                })
              } else {
                log.warn('EmailWorker no SMTP server', { subject: translatedSubject, userId: emailLocals.user.id, resultsHtml: results.html , resultsText: results.text });
                seriesCallback();
              }
            }
          });
        });
      } else {
        log.error("EmailWorker Can't find domain for email", {emailLocals: emailLocals});
        seriesCallback("Can't find domain for email");
      }
    }
  ], function (error) {
    if (error) {
      log.error("EmailWorker Error", {err: error});
      airbrake.notify(error, function(airbrakeErr, url) {
        if (airbrakeErr) {
          log.error("AirBrake Error", { context: 'airbrake', user: toJson(req.user), err: airbrakeErr, errorStatus: 500 });
        }
        callback(error);
      });
    } else {
      callback();
    }
  });
};

module.exports = new EmailWorker();
