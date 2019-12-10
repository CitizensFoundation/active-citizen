if(process.env.AIRBRAKE_PROJECT_ID) {
  const Airbrake = require('@airbrake/node');

  const airbrake = new Airbrake.Notifier({
    projectId: process.env.AIRBRAKE_PROJECT_ID,
    projectKey: process.env.AIRBRAKE_API_KEY,
  });

  module.exports = airbrake;
}


