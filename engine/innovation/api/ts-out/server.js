"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { models } = require('./models');
const app_1 = require("./app");
const analyticsController_1 = require("./controllers/analyticsController");
const memoryController_1 = require("./controllers/memoryController");
const app = new app_1.App([
    new memoryController_1.MemoryController(),
    new analyticsController_1.AnalyticsController(),
], 8000);
app.listen();
