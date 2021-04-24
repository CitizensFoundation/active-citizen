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

  return AcBackgroundJob;
};
