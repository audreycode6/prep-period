/* eslint-disable @typescript-eslint/no-unused-vars -- bodies not written yet */
import type {
  Activity,
  ActivityInput,
  ActivityStep,
  Block,
  BlockCreate,
  BlockUpdate,
  ClassroomProfile,
  Plan,
  PlanCreate,
  PlanSummary,
  PlanUpdate,
} from '@prep-period/shared';
import { db } from '../db.js';
import { findProfileIncludingArchived } from './profiles.js';

type PlanRow = {
  id: string;
  teacher_id: string;
  profile_id: string;
  title: string;
  date: string | null; // 'YYYY-MM-DD', see the DATE parser in db.ts
  is_template: boolean;
  today_note: string | null;
  share_token: string | null;
  created_at: Date;
  updated_at: Date;
};

type BlockRow = {
  id: string;
  plan_id: string;
  profile_id: string | null;
  title: string;
  description: string | null;
  start_minutes: number;
  end_minutes: number;
  created_at: Date;
  updated_at: Date;
};

type ActivityRow = {
  id: string;
  block_id: string;
  label: string;
  steps: ActivityStep[];
  minutes: number | null;
  position: number;
  created_at: Date;
  updated_at: Date;
};

type PlanSummaryRow = Pick<PlanRow, 'id' | 'title' | 'date' | 'updated_at'> & {
  profile_id: string;
  profile_name: string;
  profile_archived_at: Date | null;
};

// Blocks are ordered by their times. 'id' breaks exact ties, so two blocks with
// the same times and 'created_at' don't swap places between reloads.
const BLOCK_ORDER = ['start_minutes', 'end_minutes', 'created_at', 'id'];

function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    label: row.label,
    steps: row.steps,
    minutes: row.minutes,
  };
}

function toBlock(row: BlockRow, activities: Activity[]): Block {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startMinutes: row.start_minutes,
    endMinutes: row.end_minutes,
    activities,
  };
}

function toPlan(
  row: PlanRow,
  profile: ClassroomProfile,
  blocks: Block[],
): Plan {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    todayNote: row.today_note,
    profile,
    blocks,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toSummary(row: PlanSummaryRow): PlanSummary {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    updatedAt: row.updated_at.toISOString(),
    profile: {
      id: row.profile_id,
      name: row.profile_name,
      isArchived: row.profile_archived_at !== null,
    },
  };
}

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
 * ordered by their times and each block's activities ordered by position.
 */
async function assemblePlan(teacherId: string, row: PlanRow): Promise<Plan> {
  const profile = await findProfileIncludingArchived(teacherId, row.profile_id);
  if (!profile) {
    throw new Error('Every plan should have a profile, but this one has none');
  }

  const blockRows = await db<BlockRow>('blocks')
    .where({ plan_id: row.id })
    .orderBy(BLOCK_ORDER);
  const activityRows = await db<ActivityRow>('activities')
    .whereIn(
      'block_id',
      blockRows.map((block) => block.id),
    )
    .orderBy('position');

  const byBlock = new Map<string, Activity[]>();
  for (const activityRow of activityRows) {
    const activities = byBlock.get(activityRow.block_id) ?? [];
    activities.push(toActivity(activityRow));
    byBlock.set(activityRow.block_id, activities);
  }

  const blocks = blockRows.map((blockRow) =>
    toBlock(blockRow, byBlock.get(blockRow.id) ?? []),
  );
  return toPlan(row, profile, blocks);
}

/**
 * Gets the teacher's plan by id, with its profile (archived included), blocks
 * ordered by their times and each block's activities ordered by position.
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
    const defaultProfile = await db('classroom_profiles')
      .where({ teacher_id: teacherId, is_default: true })
      .whereNull('archived_at')
      .first('id');
    if (!defaultProfile) return 'no_profile';
    profileId = defaultProfile.id;
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
 * Applies a partial update: only the fields present in input change. A plan
 * may keep an archived profile it already uses, but cannot move to one.
 * Returns:
 * the updated plan: done
 * 'profile_not_found': profileId is not one of the teacher's profiles
 * 'profile_archived': profileId names a different, archived profile
 * undefined: plan not found or not yours
 */
export async function updatePlan(
  teacherId: string,
  id: string,
  input: PlanUpdate,
): Promise<Plan | 'profile_not_found' | 'profile_archived' | undefined> {
  throw new Error('not implemented');
}

/**
 * Deletes a plan along with its blocks and activities. Returns false when the
 * plan is not found or not yours.
 */
export async function deletePlan(
  teacherId: string,
  id: string,
): Promise<boolean> {
  throw new Error('not implemented');
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
  throw new Error('not implemented');
}

/**
 * Applies a partial update: only the fields present in input change, and the
 * times are checked against the stored ones they are not replacing. Returns:
 * the updated block with its activities: done
 * 'invalid_times': the resulting endMinutes is not after startMinutes
 * undefined: block not found or not yours
 */
export async function updateBlock(
  teacherId: string,
  id: string,
  input: BlockUpdate,
): Promise<Block | 'invalid_times' | undefined> {
  throw new Error('not implemented');
}

/**
 * Deletes a block along with its activities. Returns false when the block is
 * not found or not yours.
 */
export async function deleteBlock(
  teacherId: string,
  id: string,
): Promise<boolean> {
  throw new Error('not implemented');
}

/**
 * Makes the block's activities exactly the given list, in order. An item with
 * an id updates that activity in place; an item without one is inserted; a
 * stored activity missing from the list is deleted. Returns:
 * the block's activities, in order: done
 * 'unknown_activity': an id is not one of this block's activities, or
 *   appears twice
 * undefined: block not found or not yours
 */
export async function replaceActivities(
  teacherId: string,
  blockId: string,
  activities: ActivityInput[],
): Promise<Activity[] | 'unknown_activity' | undefined> {
  throw new Error('not implemented');
}
