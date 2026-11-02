import type {
  Activity,
  ActivityInputRequest,
  Block,
  BlockCreateRequest,
  Plan,
  PlanCreateRequest,
  PlanSummary,
} from '@prep-period/shared';
import { apiGet, apiPost, apiPut } from './client';

export function getPlans() {
  return apiGet<PlanSummary[]>('/plans');
}

export function getPlan(id: string) {
  return apiGet<Plan>(`/plans/${id}`);
}

export function createPlan(plan: PlanCreateRequest) {
  return apiPost<Plan>('/plans', plan);
}

export function addBlock(planId: string, block: BlockCreateRequest) {
  return apiPost<Block>(`/plans/${planId}/blocks`, block);
}

/**
 * Saves `activities` as the block's whole activity list, in order. An item
 * with an id updates that activity, one without is created, and any
 * activity left out is deleted.
 */
export function saveActivities(
  blockId: string,
  activities: ActivityInputRequest[],
) {
  return apiPut<Activity[]>(`/blocks/${blockId}/activities`, activities);
}
