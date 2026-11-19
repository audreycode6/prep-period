import { useState } from 'react';
import { PLAN_FILTERS, type PlanFilter } from '../planFilters';

const STORAGE_KEY = 'planListFilter';

/**
 * The filter last chosen in this browser, or `'all'` when none is stored or
 * storage can't be read.
 */
function storedFilter(): PlanFilter {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);
    return PLAN_FILTERS.find((filter) => filter === storedValue) ?? 'all';
  } catch {
    return 'all';
  }
}

/**
 * The plan list filter last chosen in this browser, starting at `'all'` when
 * none is stored or storage can't be read, with a setter that also stores
 * the choice when it can.
 */
export function useStoredPlanFilter() {
  const [filter, setFilter] = useState(storedFilter);

  function setAndStoreFilter(chosen: PlanFilter) {
    setFilter(chosen);
    try {
      localStorage.setItem(STORAGE_KEY, chosen);
    } catch {
      // unstored, the choice still applies until the component unmounts
    }
  }

  return [filter, setAndStoreFilter] as const;
}
