import type { PlanSummary } from '@prep-period/shared';

export const PLAN_FILTERS = ['all', 'plans', 'templates'] as const;

export type PlanFilter = (typeof PLAN_FILTERS)[number];

/**
 * Whether the filter keeps the plan: All keeps every plan, Plans keeps those
 * not marked as templates, and Templates keeps templates.
 */
export function matchesFilter(plan: PlanSummary, filter: PlanFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'plans':
      return !plan.isTemplate;
    case 'templates':
      return plan.isTemplate;
  }
}
