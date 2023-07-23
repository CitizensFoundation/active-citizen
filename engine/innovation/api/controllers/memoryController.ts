import express from "express";
import { models } from "../models";

export class CommentsController {
  public path = "/api/memory";
  public router = express.Router();

  constructor() {
    this.intializeRoutes();
  }

  public intializeRoutes() {
    this.router.put(this.path + "/current", this.current);
  }

  current = async (req: express.Request, res: express.Response) => {
    // Get current memory from the redis database
    const output = await redis.get('st_mem:1:id');
    const memory = JSON.parse(output);

    res.send({
      isAdmin: true,
      name: "Collective Policy Synth - Democracy",
      currentMemory: memory
    });
  };
}
