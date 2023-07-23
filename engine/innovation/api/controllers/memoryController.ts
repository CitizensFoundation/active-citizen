import express from "express";
import { models } from "../models";
import {
  createClient,
} from "redis";

let redisClient: any;

if (process.env.REDIS_URL) {
  redisClient = createClient({
    url: process.env.REDIS_URL,
    socket: {
      tls: true,
    },
  });
} else {
  redisClient = createClient({
    url: "redis://localhost:6379",
  });
}

export class MemoryController {
  public path = "/api/memory";
  public router = express.Router();

  constructor() {
    this.intializeRoutes();
  }

  public async intializeRoutes() {
    this.router.get(this.path + "/:id", this.getMemory);
    await redisClient.connect();
  }

  getMemory = async (req: express.Request, res: express.Response) => {
    const rawMemory = await redisClient.get(`st_mem:${req.params.id}:id`).catch((err: any) => console.error(err));
    if (rawMemory) {
      const memory = JSON.parse(rawMemory);

      res.send({
        isAdmin: true,
        name: "Collective Policy Synth - Democracy",
        currentMemory: memory,
        configuration: {}
      });
    } else {
      res.sendStatus(404);
    }
  };
}
