import type {
  Plan,
  PlanCreate,
  PlanSummary,
  PlanUpdate,
} from '@prep-period/shared';
import { db } from '../db.js';
import {
  readBlockContents,
  toBlock,
  toPlan,
  toSummary,
  type BlockRow,
  type PlanRow,
  type PlanSummaryRow,
} from './planRows.js';
import {
  findDefaultProfileId,
  findProfileIncludingArchived,
} from './profiles.js';

// Blocks are ordered by their times. 'id' breaks exact ties, so two blocks with
// the same times and 'created_at' don't swap places between reloads.
const BLOCK_ORDER = ['start_minutes', 'end_minutes', 'created_at', 'id'];

/**
 * Lists the teacher's plans, ordered by most recently updated, each with its
 * profile's id, name and whether it is archived.
 */
export async function listPlans(teacherId: string): Promise<PlanSummary[]> {
  const rows: PlanSummaryRow[] = await db('plans')
    .join('classroom_profiles', 'classroom_profiles.id', 'plans.profile_id')
    .where('plans.teacher_id', teacherId)
    .orderBy('plans.updated_at', 'desc')
    .select(
      'plans.id',
      'plans.title',
      'plans.date',
      'plans.updated_at',
      'classroom_profiles.id as profile_id',
      'classroom_profiles.name as profile_name',
      'classroom_profiles.archived_at as profile_archived_at',
    );
  return rows.map(toSummary);
}

/**
 * Builds the full plan from its row: the profile (archived included), blocks
 * ordered by their times, and each block's activities and annotations by
 * position.
 */
async function assemblePlan(teacherId: string, row: PlanRow): Promise<Plan> {
  const profile = await findProfileIncludingArchived(teacherId, row.profile_id);
  if (!profile) {
    throw new Error('Every plan should have a profile, but this one has none');
  }

  const blockRows = await db<BlockRow>('blocks')
    .where({ plan_id: row.id })
    .orderBy(BLOCK_ORDER);
  const { activities, annotations } = await readBlockContents(
    db,
    blockRows.map((block) => block.id),
  );

  const blocks = blockRows.map((blockRow) =>
    toBlock(
      blockRow,
      activities.get(blockRow.id) ?? [],
      annotations.get(blockRow.id) ?? [],
    ),
  );
  return toPlan(row, profile, blocks);
}

/**
 * Gets the teacher's plan by id, with its profile (archived included), blocks
 * ordered by their times, and each block's activities and annotations by
 * position.
 * Returns undefined when the plan is not found or not yours.
 */
export async function findPlan(
  teacherId: string,
  id: string,
): Promise<Plan | undefined> {
  const row = await db<PlanRow>('plans')
    .where({ id, teacher_id: teacherId })
    .first();
  return row ? assemblePlan(teacherId, row) : undefined;
}

/**
 * Creates a plan with no blocks. Without a profileId it uses the teacher's
 * default profile. Returns:
 * the new plan: done
 * 'no_profile': no profileId, and the teacher has no profile to default to
 * 'profile_not_found': profileId is not one of the teacher's profiles
 * 'profile_archived': profileId names an archived profile
 */
export async function insertPlan(
  teacherId: string,
  input: PlanCreate,
): Promise<Plan | 'no_profile' | 'profile_not_found' | 'profile_archived'> {
  let profileId: string;
  if (input.profileId) {
    const profile = await findProfileIncludingArchived(
      teacherId,
      input.profileId,
    );
    if (!profile) return 'profile_not_found';
    if (profile.isArchived) return 'profile_archived';
    profileId = profile.id;
  } else {
    const defaultProfileId = await findDefaultProfileId(teacherId);
    if (!defaultProfileId) return 'no_profile';
    profileId = defaultProfileId;
  }

  const [row]: PlanRow[] = await db('plans')
    .insert({
      teacher_id: teacherId,
      profile_id: profileId,
      title: input.title,
      date: input.date,
      today_note: input.todayNote,
    })
    .returning('*');
  return assemblePlan(teacherId, row);
}

/**
 * Applies a partial update: only the fields present in input change, and an
 * empty input changes nothing. A plan may keep an archived profile it already
 * uses, but cannot move to a different archived one. Returns:
 * the updated plan: done
 * 'profile_not_found': profileId is not one of this teacher's profiles
 * 'profile_archived': profileId is a different profile of theirs that is archived
 * undefined: plan not found or not yours
 */
export async function updatePlan(
  teacherId: string,
  id: string,
  input: PlanUpdate,
): Promise<Plan | 'profile_not_found' | 'profile_archived' | undefined> {
  const existing = await db<PlanRow>('plans')
    .where({ id, teacher_id: teacherId })
    .first();
  if (!existing) return undefined;

  if (
    input.profileId !== undefined &&
    input.profileId !== existing.profile_id
  ) {
    const profile = await findProfileIncludingArchived(
      teacherId,
      input.profileId,
    );
    if (!profile) return 'profile_not_found';
    // changing a plan to an archived profile is refused
    if (profile.isArchived) return 'profile_archived';
  }

  const changes: Record<string, unknown> = {};
  if (input.title !== undefined) changes.title = input.title;
  if (input.date !== undefined) changes.date = input.date;
  if (input.todayNote !== undefined) changes.today_note = input.todayNote;
  if (input.profileId !== undefined) changes.profile_id = input.profileId;
  if (Object.keys(changes).length === 0) {
    return assemblePlan(teacherId, existing);
  }

  const [row]: PlanRow[] = await db('plans')
    .where({ id, teacher_id: teacherId })
    .update({ ...changes, updated_at: db.fn.now() })
    .returning('*');
  // deleted between the read and the update
  if (!row) return undefined;
  return assemblePlan(teacherId, row);
}

/**
 * Deletes a plan along with its blocks and activities. Returns false when the
 * plan is not found or not yours.
 */
export async function deletePlan(
  teacherId: string,
  id: string,
): Promise<boolean> {
  const deleted = await db('plans').where({ id, teacher_id: teacherId }).del();
  return deleted > 0;
}
