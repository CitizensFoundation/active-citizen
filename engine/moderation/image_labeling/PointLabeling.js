const ImageLabelingBase = require("./ImageLabelingBase");
const models = require("../../../../models");

class PointLabeling extends ImageLabelingBase {
  async getCollection() {
    return await new Promise(async (resolve, reject) => {
      try {
        const post = await models.Point.findOne({
          where: {
            id: this.workPackage.pointId,
          },
          attributes: ["id","data"],
        });
        resolve(post);
      } catch (post) {
        reject(error);
      }
    });
  }

  async reviewImagesFromCollection() {
    return await new Promise(async (resolve, reject) => {
      try {
        await this.reviewAndLabelVideos(
          models.Point,
          this.collection.id,
          "PointVideos"
        );
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = PointLabeling;
