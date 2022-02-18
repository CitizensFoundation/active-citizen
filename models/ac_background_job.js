"use strict";

module.exports = (sequelize, DataTypes) => {
  const AcBackgroundJob = sequelize.define("AcBackgroundJob", {
    progress: { type: DataTypes.INTEGER, allowNull: true },
    error: { type: DataTypes.TEXT, allowNull: true },
    data: DataTypes.JSONB
  }, {

    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    underscored: true,

    tableName: 'ac_background_jobs',
  });

  AcBackgroundJob.createJob = (data, done) => {
    sequelize.models.AcBackgroundJob.create({
      progress: 5,
      data: data,
    }).then(job => {
      done(null, job.id);
    }).catch(error => {
      done(error)
    })
  };

  AcBackgroundJob.updateProgress = (jobId, progress, done) => {
    sequelize.models.AcBackgroundJob.update(
      {
        progress: progress,
      },
      {
        where: { id: jobId },
      }
    )
      .then(() => {
        done();
      })
      .catch((error) => {
        done(error);
      });
  }

  AcBackgroundJob.updateProgressAsync = async (jobId, progress) => {
    return await new Promise(async (resolve, reject) => {
      try {
        resolve(sequelize.models.AcBackgroundJob.update({
          progress: progress
        },
        {
          where: { id: jobId },
        }))
      } catch (error) {
        reject(error);
      }
    });
  };

  AcBackgroundJob.updateDataAsync = async (jobId, data) => {
    return await new Promise(async (resolve, reject) => {
      try {
        resolve(sequelize.models.AcBackgroundJob.update({
            data: data
          },
          {
            where: { id: jobId },
          }))
      } catch (error) {
        reject(error);
      }
    });
  };

  AcBackgroundJob.destroyJobAsync = async (jobId) => {
    return await new Promise(async (resolve, reject) => {
      try {
        resolve(sequelize.models.AcBackgroundJob.destroy({
            where: { id: jobId },
          }))
      } catch (error) {
        reject(error);
      }
    });
  };

  return AcBackgroundJob;
};
