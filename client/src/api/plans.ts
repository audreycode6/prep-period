import type { Plan, PlanCreateRequest, PlanSummary } from '@prep-period/shared';
import { apiGet, apiPost } from './client';

export function getPlans() {
  return apiGet<PlanSummary[]>('/plans');
}

export function createPlan(plan: PlanCreateRequest) {
  return apiPost<Plan>('/plans', plan);
}
