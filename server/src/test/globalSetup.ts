import knex from 'knex';
import knexConfig from '../knexConfig.js';

export default async function setup() {
  const db = knex(knexConfig.test);
  try {
    await db.migrate.latest();
  } finally {
    await db.destroy();
  }
}
