/* eslint-disable @typescript-eslint/no-unused-vars -- bodies not written yet */
import type {
  Activity,
  ActivityInput,
  Block,
  BlockCreate,
  BlockUpdate,
  Plan,
  PlanCreate,
  PlanSummary,
  PlanUpdate,
} from '@prep-period/shared';

/**
 * Lists the teacher's plans, each with its profile's id, name and whether it
 * is archived.
 */
export async function listPlans(teacherId: string): Promise<PlanSummary[]> {
  throw new Error('not implemented');
}

/**
 * Reads a plan with its profile (archived included), its blocks ordered by
 * start_minutes, end_minutes, created_at, and each block's activities ordered
 * by position. Returns undefined when the plan is not found or not yours.
 */
export async function findPlan(
  teacherId: string,
  id: string,
): Promise<Plan | undefined> {
  throw new Error('not implemented');
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
  throw new Error('not implemented');
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
