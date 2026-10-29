import knex from 'knex';
import { types } from 'pg';
import knexConfig from './knexConfig.js';
import { config } from './config.js';

// When a query returns a DATE column, keep unchanged as'YYYY-MM-DD';
// pg's default Date can shift a day in toISOString().
types.setTypeParser(types.builtins.DATE, (value) => value);

export const db = knex(
  knexConfig[config.nodeEnv === 'test' ? 'test' : 'development'],
);
