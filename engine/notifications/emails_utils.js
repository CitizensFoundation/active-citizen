var DEBUG_EMAILS_TO_TEMP_FIlE = false;

var log = require('../../utils/logger');
var toJson = require('../../utils/to_json');
var async = require('async');
var path = require('path');
var EmailTemplate = require('email-templates').EmailTemplate;
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var ejs = require('ejs');
var i18n = require('../../utils/i18n');
var airbrake = null;

if(process.env.AIRBRAKE_PROJECT_ID) {
  airbrake = require('../../utils/airbrake');
}

var fs = require('fs');

var templatesDir = path.resolve(__dirname, '..', '..', 'email_templates', 'notifications');

var queue = require('../../workers/queue');
var models = require("../../../models");

var i18nFilter = function(text) {
  return i18n.t(text);
};

var transport = null;

if (process.env.SENDGRID_USERNAME) {
  transport = nodemailer.createTransport({
    service: 'sendgrid',
    auth: {
      user: process.env.SENDGRID_USERNAME,
      pass: process.env.SENDGRID_PASSWORD
    }
  });
} else if (process.env.SMTP_SERVER) {
  var smtpConfig = {
    host: process.env.SMTP_SERVER,
    port: process.env.SMTP_PORT,
    secure: false, // upgrade later with STARTTLS
    auth: process.env.SMTP_USERNAME ? {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD
    } : null,
    tls: {
      rejectUnauthorized: !process.env.SMTP_ACCEPT_INVALID_CERT
    }
  };

  transport = nodemailer.createTransport(smtpTransport(smtpConfig));

  transport.verify(function(error, success) {
    if (error) {
      log.error(error);
    } else {
      log.info('Server is ready to take our messages');
    }
  });
}

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

var filterNotificationForDelivery = function (notification, user, template, subject, callback) {
  var method = user.notifications_settings[notification.from_notification_setting].method;
  var frequency = user.notifications_settings[notification.from_notification_setting].frequency;

  //TODO: Switch from FREQUENCY_AS_IT_HAPPENS if user has had a lot of emails > 25 in the hour or something

  log.info("Notification Email Processing", {email: user.email, notification_settings_type: notification.notification_setting_type,
                                                method: method, frequency: frequency});

  if (method !== models.AcNotification.METHOD_MUTED) {
    if (frequency === models.AcNotification.FREQUENCY_AS_IT_HAPPENS) {
      log.info("Notification Email Processing Sending eMail", {email: user.email, method: method, frequency: frequency});
      queue.create('send-one-email', {
        subject: subject,
        template: template,
        user: user,
        domain: notification.AcActivities[0].Domain,
        group: (notification.AcActivities[0].Point && notification.AcActivities[0].Point.Group && notification.AcActivities[0].Point.Group.name!="hidden_public_group_for_domain_level_points") ?
          notification.AcActivities[0].Point.Group : notification.AcActivities[0].Group,
        community: notification.AcActivities[0].Community,
        activity: notification.AcActivities[0],
        post: notification.AcActivities[0].Post,
        point: notification.AcActivities[0].Point
      }).priority('critical').removeOnComplete(true).save();
      callback();
    } else if (method !== models.AcNotification.METHOD_MUTED) {
      models.AcDelayedNotification.findOrCreate({
        where: {
          user_id: user.id,
          method: method,
          frequency: frequency
        },
        defaults: {
          user_id: user.id,
          method: method,
          frequency: frequency,
          type: notification.from_notification_setting
        }
      }).spread(function(delayedNotification, created) {
        if (created) {
          log.info('Notification Email Processing AcDelayedNotification Created', { delayedNotification: toJson(delayedNotification), context: 'create' });
        } else {
          log.info('Notification Email Processing AcDelayedNotification Loaded', { delayedNotification: toJson(delayedNotification), context: 'loaded' });
        }
        delayedNotification.addAcNotifications(notification).then(function (results) {
          if (delayedNotification.delivered) {
            log.info('Notification Email Processing AcDelayedNotification already delivered resetting');
            delayedNotification.delivered = false;
            delayedNotification.save().then(function (results) {
              callback();
            });
          } else {
            callback();
          }
        });
      }).catch(function (error) {
        callback(error);
      });
    }
  } else {
    callback();
  }
};

var sendOneEmail = function (emailLocals, callback) {
  var template, fromEmail=null, sender=null, replyTo=null;

  if (!emailLocals.isReportingContent)
    emailLocals.isReportingContent = false;
  if (!emailLocals.isAutomated)
    emailLocals.isAutomated = false;

  async.series([
    function (seriesCallback) {
      if (emailLocals.domain && emailLocals.domain.domain_name) {
        seriesCallback();
      } else {
        log.error("EmailWorker Can't find domain for email", {emailLocals: emailLocals});
        seriesCallback("Can't find domain for email");
      }
    },

    function (seriesCallback) {
      if (emailLocals.user && emailLocals.user.email) {
        seriesCallback();
      } else {
        log.warn("EmailWorker Can't find email for users", {emailLocals: emailLocals});
        seriesCallback();
      }
    },

    function (seriesCallback) {
      log.info("EmailWorker Started Setup", {});

      template = new EmailTemplate(path.join(templatesDir, emailLocals.template));

      emailLocals['t'] = i18nFilter;
      emailLocals['linkTo'] = linkTo;

      if (!emailLocals['community']) {
        emailLocals['community'] = {
          hostname: process.env.DEFAULT_HOSTNAME ? process.env.DEFAULT_HOSTNAME : 'app'
        }
      }

      if (emailLocals.domain.domain_name.indexOf('betrireykjavik.is') > -1) {
        fromEmail = 'Betri Reykjavík <betrireykjavik@ibuar.is>';
      } else if (emailLocals.domain.domain_name.indexOf('betraisland.is') > -1) {
        fromEmail = 'Betra Ísland <betraisland@ibuar.is>';
      } else if (emailLocals.domain.domain_name.indexOf('forbrukerradet.no') > -1) {
        fromEmail = 'Mine idéer Forbrukerrådet <mineideer@forbrukerradet.no>';
      } else if (emailLocals.domain.domain_name.indexOf('e-dem.nl') > -1) {
        fromEmail = 'admin@yrpr.e-dem.nl';
      } else if (emailLocals.domain.domain_name.indexOf('idea-synergy.com') > -1) {
        fromEmail = 'ideasynergy@idea-synergy.com';
      } else if (emailLocals.domain.domain_name.indexOf('smarter.nj.gov') > -1) {
        fromEmail = null;
        sender = "support@participation.smarter.nj.gov";
        replyTo = "support@smarter.nj.gov";
      } else if (process.env.EMAIL_FROM) {
        fromEmail = process.env.EMAIL_FROM;
      } else {
        fromEmail = 'Your Priorities <admin@yrpri.org>';
      }

      emailLocals.headerImageUrl = "";
      seriesCallback();
    },

    function (seriesCallback) {
      log.info("EmailWorker Started Locale", {});
      var locale;

      if (emailLocals.post && emailLocals.point && !emailLocals.point.Post) {
        emailLocals.point.Post = emailLocals.post;
      }

      if (emailLocals.user.default_locale && emailLocals.user.default_locale != "") {
        locale = emailLocals.user.default_locale;
      } else if (emailLocals.community && emailLocals.community.default_locale && emailLocals.community.default_locale != "") {
        locale = emailLocals.community.default_locale;
      } else if (emailLocals.domain && emailLocals.domain.default_locale && emailLocals.domain.default_locale != "") {
        locale = emailLocals.domain.default_locale;
      } else {
        locale = 'en';
      }

      log.info("EmailWorker Selected locale", {locale: locale});

      i18n.changeLanguage(locale, function (err, t) {
        seriesCallback(err);
      });
    },

    function (seriesCallback) {
      log.info("EmailWorker Started Sending", {});

      template.render(emailLocals, function (error, results) {
        if (error) {
          log.error('EmailWorker Error', { err: error, userId: emailLocals.user.id });
          seriesCallback(error);
        } else {
          var translatedSubject = translateSubject(emailLocals.subject);

          if (transport) {
            if (emailLocals.user.profile_data &&
                emailLocals.user.profile_data.isAnonymousUser &&
                emailLocals.user.email.indexOf('anonymous') > -1) {
              log.info("Not sending email for anonymous user", {email: emailLocals.user.email});
              seriesCallback();
            } else {
              transport.sendMail({
                from: fromEmail,
                sender: sender,
                replyTo: replyTo,
                to: emailLocals.user.email,
                bcc: process.env.ADMIN_EMAIL_BCC ? process.env.ADMIN_EMAIL_BCC : null,
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
            }
          } else {
            log.warn('EmailWorker no email configured.', { subject: translatedSubject, userId: emailLocals.user.id, resultsHtml: results.html , resultsText: results.text });
            if (DEBUG_EMAILS_TO_TEMP_FIlE) {
              var fileName = "/tmp/testHtml_"+parseInt(Math.random() * (423432432432 - 1232) + 1232)+".html";
              fs.unlink(fileName, function (err) {
                fs.writeFile(fileName, results.html, function(err) {
                  if(err) {
                    log.error(err);
                  }
                  seriesCallback();
                });
              });
            } else {
              seriesCallback();
            }
          }
        }
      });
    }
  ], function (error) {
    if (error) {
      log.error("EmailWorker Error", {err: error});
      if(airbrake) {
        airbrake.notify(error, function(airbrakeErr, url) {
          if (airbrakeErr) {
            log.error("AirBrake Error", { context: 'airbrake', err: airbrakeErr, errorStatus: 500 });
          }
          callback(error);
        });
      } else {
        callback(error);
      }
    } else {
      callback();
    }
  });
};

module.exports = {
  filterNotificationForDelivery: filterNotificationForDelivery,
  sendOneEmail: sendOneEmail
};
