"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryController = void 0;
const express_1 = __importDefault(require("express"));
const redis_1 = require("redis");
let redisClient;
if (process.env.REDIS_URL) {
    redisClient = (0, redis_1.createClient)({
        url: process.env.REDIS_URL,
        socket: {
            tls: true,
        },
    });
}
else {
    redisClient = (0, redis_1.createClient)({
        url: "redis://localhost:6379",
    });
}
class MemoryController {
    path = "/api/memory";
    router = express_1.default.Router();
    constructor() {
        this.intializeRoutes();
    }
    intializeRoutes() {
        this.router.get(this.path + "/:id", this.getMemory);
    }
    getMemory = async (req, res) => {
        const rawMemory = await redisClient.get(`st_mem:${req.params.id}:id`);
        if (rawMemory) {
            const memory = JSON.parse(rawMemory);
            res.send({
                isAdmin: true,
                name: "Collective Policy Synth - Democracy",
                currentMemory: memory,
            });
        }
        else {
            res.sendStatus(404);
        }
    };
}
exports.MemoryController = MemoryController;