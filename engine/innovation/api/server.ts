const { models } = require('./models');
import { App } from './app';
import { MemoryController } from './controllers/memoryController';

const app = new App(
  [
    new MemoryController(),
  ],
  8000,
);

app.listen();