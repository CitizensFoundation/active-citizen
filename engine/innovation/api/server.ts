const { models } = require('./models');
import { App } from './app';
import { AnalyticsController } from './controllers/analyticsController';
import { MemoryController } from './controllers/memoryController';

const app = new App(
  [
    new MemoryController(),
    new AnalyticsController(),
  ],
  8000,
);

app.listen();