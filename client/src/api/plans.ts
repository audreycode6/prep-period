import type {
  Block,
  BlockCreateRequest,
  Plan,
  PlanCreateRequest,
  PlanSummary,
  PlanUpdate,
} from '@prep-period/shared';
import { apiDel, apiGet, apiPatch, apiPost } from './client';

export function getPlans() {
  return apiGet<PlanSummary[]>('/plans');
}

export function getPlan(id: string) {
  return apiGet<Plan>(`/plans/${id}`);
}

export function createPlan(plan: PlanCreateRequest) {
  return apiPost<Plan>('/plans', plan);
}

/**
 * Updates only the fields present in `changes` and returns the updated plan.
 */
export function updatePlan(id: string, changes: PlanUpdate) {
  return apiPatch<Plan>(`/plans/${id}`, changes);
}

/**
 * Deletes the plan along with its blocks, activities and annotations.
 */
export function deletePlan(id: string) {
  return apiDel(`/plans/${id}`);
}

export function addBlock(planId: string, block: BlockCreateRequest) {
  return apiPost<Block>(`/plans/${planId}/blocks`, block);
}
