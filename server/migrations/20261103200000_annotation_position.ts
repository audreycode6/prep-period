import type { Knex } from 'knex';

/**
 * Adds a position column to the annotations table, numbers existing rows from
 * 0 within each block in the order they were created, then makes the column
 * not null.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('annotations', (t) => {
    t.integer('position').nullable();
  });
  await knex.raw(`
    update annotations
    set position = numbered.position
    from (
      select id, row_number() over (
        partition by block_id order by created_at, id
      ) - 1 as position
      from annotations
    ) as numbered
    where annotations.id = numbered.id
  `);
  await knex.schema.alterTable('annotations', (t) => {
    t.dropNullable('position');
  });
}

/**
 * Drops the annotations' position column.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('annotations', (t) => {
    t.dropColumn('position');
  });
}
