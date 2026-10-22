import type { Knex } from 'knex';
import { config } from './config.js';

const testUrl = new URL(config.databaseUrl);
testUrl.pathname = '/prep_period_test';

const shared = {
  client: 'pg',
  migrations: { directory: './migrations', extension: 'ts' },
} satisfies Knex.Config;

const knexConfig: Record<'development' | 'test', Knex.Config> = {
  development: { ...shared, connection: config.databaseUrl },
  test: { ...shared, connection: testUrl.toString() },
};

export default knexConfig;
