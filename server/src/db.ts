import knex from 'knex';
import knexConfig from './knexConfig.js';
import { config } from './config.js';

export const db = knex(
  knexConfig[config.nodeEnv === 'test' ? 'test' : 'development'],
);
