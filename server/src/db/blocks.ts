import type { Knex } from 'knex';
import type {
  Activity,
  ActivityInput,
  Annotation,
  AnnotationInput,
  Block,
  BlockCreate,
  BlockUpdate,
} from '@prep-period/shared';
import { db } from '../db.js';
import {
  readBlockContents,
  toActivity,
  toAnnotation,
  toBlock,
  type ActivityRow,
  type AnnotationRow,
  type BlockRow,
} from './planRows.js';

/**
 * Sets the plan's updated_at to now.
 */
async function markPlanUpdated(
  trx: Knex.Transaction,
  planId: string,
): Promise<void> {
  await trx('plans').where({ id: planId }).update({ updated_at: db.fn.now() });
}

/**
 * Adds a block, with no activities, to a plan. Returns:
 * the new block: done
 * 'invalid_times': endMinutes is not after startMinutes
 * undefined: plan not found or not yours
 */
export async function insertBlock(
  teacherId: string,
  planId: string,
  input: BlockCreate,
): Promise<Block | 'invalid_times' | undefined> {
  if (input.endMinutes <= input.startMinutes) return 'invalid_times';

  return db.transaction(async (trx) => {
    const plan = await trx('plans')
      .where({ id: planId, teacher_id: teacherId })
      .first('id');
    if (!plan) return undefined;

    const [row]: BlockRow[] = await trx('blocks')
      .insert({
        plan_id: planId,
        title: input.title,
        description: input.description,
        start_minutes: input.startMinutes,
        end_minutes: input.endMinutes,
      })
      .returning('*');
    await markPlanUpdated(trx, planId);
    return toBlock(row, [], []);
  });
}

/**
 * Gets a block by id when its plan is the teacher's. Returns undefined when
 * the block is not found or not yours.
 */
async function findOwnedBlock(
  trx: Knex.Transaction,
  teacherId: string,
  id: string,
): Promise<BlockRow | undefined> {
  return trx('blocks')
    .join('plans', 'plans.id', 'blocks.plan_id')
    .where({ 'blocks.id': id, 'plans.teacher_id': teacherId })
    .first('blocks.*');
}

/**
 * Applies a partial update: only the fields present in input change, and an
 * empty input changes nothing. Times are checked against the saved ones,
 * so the block still ends after it starts. Returns:
 * the updated block with its activities and annotations: done
 * 'invalid_times': the resulting endMinutes is not after startMinutes
 * undefined: block not found or not yours
 */
export async function updateBlock(
  teacherId: string,
  id: string,
  input: BlockUpdate,
): Promise<Block | 'invalid_times' | undefined> {
  return db.transaction(async (trx) => {
    const existing = await findOwnedBlock(trx, teacherId, id);
    if (!existing) return undefined;

    const startMinutes = input.startMinutes ?? existing.start_minutes;
    const endMinutes = input.endMinutes ?? existing.end_minutes;
    if (endMinutes <= startMinutes) return 'invalid_times';

    const changes: Record<string, unknown> = {};
    if (input.title !== undefined) changes.title = input.title;
    if (input.description !== undefined)
      changes.description = input.description;
    if (input.startMinutes !== undefined)
      changes.start_minutes = input.startMinutes;
    if (input.endMinutes !== undefined) changes.end_minutes = input.endMinutes;

    let row: BlockRow = existing;
    if (Object.keys(changes).length > 0) {
      [row] = await trx('blocks')
        .where({ id })
        .update({ ...changes, updated_at: db.fn.now() })
        .returning('*');
      await markPlanUpdated(trx, existing.plan_id);
    }

    const { activities, annotations } = await readBlockContents(trx, [id]);
    return toBlock(row, activities.get(id) ?? [], annotations.get(id) ?? []);
  });
}

/**
 * Deletes a block along with its activities. Returns false when the block is
 * not found or not yours.
 */
export async function deleteBlock(
  teacherId: string,
  id: string,
): Promise<boolean> {
  return db.transaction(async (trx) => {
    const existing = await findOwnedBlock(trx, teacherId, id);
    if (!existing) return false;

    await trx('blocks').where({ id }).del();
    await markPlanUpdated(trx, existing.plan_id);
    return true;
  });
}

/**
 * Returns the incoming ids that match existing activities, or
 * 'invalid_activity_ids' when one doesn't match or appears twice. Items
 * without an id are new and skipped.
 */
function findIdsToUpdate(
  existingIds: Set<string>,
  incoming: ActivityInput[],
): Set<string> | 'invalid_activity_ids' {
  const idsToUpdate = new Set<string>();
  for (const activity of incoming) {
    if (activity.id === undefined) continue;
    if (!existingIds.has(activity.id) || idsToUpdate.has(activity.id)) {
      // invalid input: stop the save before anything is written
      return 'invalid_activity_ids';
    }
    idsToUpdate.add(activity.id);
  }
  return idsToUpdate;
}

/**
 * Makes the block's activities match incoming, in order: items with an
 * existing id are updated, items without one are inserted, and existing ones
 * left out are deleted. Returns:
 * the saved activities: done
 * 'invalid_activity_ids': an id isn't this block's, or appears twice
 * undefined: block not found or not yours
 */
export async function replaceActivities(
  teacherId: string,
  blockId: string,
  incoming: ActivityInput[],
): Promise<Activity[] | 'invalid_activity_ids' | undefined> {
  return db.transaction(async (trx) => {
    const block = await findOwnedBlock(trx, teacherId, blockId);
    if (!block) return undefined;

    // ids of the block's activities in the database, before this save
    const existingIds = new Set<string>(
      await trx('activities').where({ block_id: blockId }).pluck('id'),
    );
    const idsToUpdate = findIdsToUpdate(existingIds, incoming);
    if (idsToUpdate === 'invalid_activity_ids') return 'invalid_activity_ids';
    const idsToDelete = [...existingIds].filter((id) => !idsToUpdate.has(id));
    await trx('activities').whereIn('id', idsToDelete).del();

    // Write incoming in order: the index becomes position, items without an id
    // are inserted, and the rest are updated in place.
    for (const [position, activity] of incoming.entries()) {
      const fields = {
        label: activity.label,
        steps: JSON.stringify(activity.steps),
        minutes: activity.minutes,
        position,
      };

      if (activity.id === undefined) {
        await trx('activities').insert({ ...fields, block_id: blockId });
      } else {
        await trx('activities')
          .where({ id: activity.id })
          .update({ ...fields, updated_at: db.fn.now() });
      }
    }

    await markPlanUpdated(trx, block.plan_id);

    const rows: ActivityRow[] = await trx('activities')
      .where({ block_id: blockId })
      .orderBy('position');
    return rows.map(toActivity);
  });
}

/**
 * Replaces the block's annotations with incoming, in order: the old ones are
 * deleted and incoming is inserted, each item's index becoming its position.
 * Returns:
 * the saved annotations, by position: done
 * 'invalid_activity_ids': an activityId isn't one of this block's activities
 * undefined: block not found or not yours
 */
export async function replaceAnnotations(
  teacherId: string,
  blockId: string,
  incoming: AnnotationInput[],
): Promise<Annotation[] | 'invalid_activity_ids' | undefined> {
  return db.transaction(async (trx) => {
    const block = await findOwnedBlock(trx, teacherId, blockId);
    if (!block) return undefined;

    const activityIds = new Set<string>(
      await trx('activities').where({ block_id: blockId }).pluck('id'),
    );
    const hasInvalidActivityId = incoming.some(
      (annotation) =>
        annotation.activityId !== null &&
        !activityIds.has(annotation.activityId),
    );
    if (hasInvalidActivityId) return 'invalid_activity_ids';

    await trx('annotations').where({ block_id: blockId }).del();

    // skip the insert when incoming is empty: nothing to add, the old
    // annotations were just deleted, and Knex throws on an insert of no rows
    if (incoming.length > 0) {
      await trx('annotations').insert(
        incoming.map((annotation, position) => ({
          block_id: blockId,
          activity_id: annotation.activityId,
          type: annotation.type,
          text: annotation.text,
          position,
        })),
      );
    }

    await markPlanUpdated(trx, block.plan_id);

    const rows: AnnotationRow[] = await trx('annotations')
      .where({ block_id: blockId })
      .orderBy('position');
    return rows.map(toAnnotation);
  });
}
