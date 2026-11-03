import type { Knex } from 'knex';

// minutes since midnight: a block may end at 23:59 at the latest
const LAST_MINUTE_OF_DAY = 1439;
// the end the minutes check allowed before this migration
const PREVIOUS_MAX_END = 1440;

// required text columns that must not be empty or only spaces
const REQUIRED_TEXT = [
  ['classroom_profiles', 'name'],
  ['plans', 'title'],
  ['blocks', 'title'],
  ['activities', 'label'],
  ['resources', 'title'],
] as const;

function notEmptyCheckName(table: string, column: string): string {
  return `${table}_${column}_not_empty_check`;
}

/**
 * Updates the blocks_minutes_check constraint so a block may end at minute
 * `maxEnd` at the latest, by dropping it and adding it back under the same
 * name with the new limit.
 */
async function setBlockMinutesCheck(knex: Knex, maxEnd: number) {
  await knex.schema.alterTable('blocks', (t) => {
    t.dropChecks('blocks_minutes_check');
  });
  await knex.schema.alterTable('blocks', (t) => {
    t.check(
      `start_minutes >= 0 and end_minutes <= ${maxEnd} and end_minutes > start_minutes`,
      [],
      'blocks_minutes_check',
    );
  });
}

/**
 * Adds a not-empty check constraint to each required text column, and
 * updates blocks_minutes_check to limit a block's end to LAST_MINUTE_OF_DAY.
 */
export async function up(knex: Knex): Promise<void> {
  for (const [table, column] of REQUIRED_TEXT) {
    await knex.schema.alterTable(table, (t) => {
      t.check(`btrim(${column}) <> ''`, [], notEmptyCheckName(table, column));
    });
  }
  await setBlockMinutesCheck(knex, LAST_MINUTE_OF_DAY);
}

/**
 * Drops the not-empty check constraints from the required text columns, and
 * updates blocks_minutes_check back to limit a block's end to
 * PREVIOUS_MAX_END.
 */
export async function down(knex: Knex): Promise<void> {
  await setBlockMinutesCheck(knex, PREVIOUS_MAX_END);
  for (const [table, column] of REQUIRED_TEXT) {
    await knex.schema.alterTable(table, (t) => {
      t.dropChecks(notEmptyCheckName(table, column));
    });
  }
}
