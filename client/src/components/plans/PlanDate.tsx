import { useState } from 'react';
import type { Plan } from '@prep-period/shared';
import { updatePlan } from '../../api/plans';
import {
  useReportUnsavedChanges,
  type OnUnsavedChange,
} from '../../hooks/unsavedChanges';
import { useRequest } from '../../hooks/useRequest';

type Props = {
  planId: string;
  // YYYY-MM-DD, or null for a plan with no date
  date: string | null;
  onSaved: (plan: Plan) => void;
  onUnsavedChange?: OnUnsavedChange;
};

/**
 * Edits the plan's date. Save date, enabled while the input holds a valid
 * date other than the saved one, saves it. Remove date, shown while the plan
 * has a date, saves null right away. Both hand the updated plan to
 * `onSaved`; a failed save shows its error.
 */
export function PlanDate({ planId, date, onSaved, onUnsavedChange }: Props) {
  // a date input's value is '' while it's empty or holds an incomplete or
  // invalid date
  const [draftDate, setDraftDate] = useState(date ?? '');
  const { pending: saving, error, run } = useRequest();

  const hasUnsavedChanges = draftDate !== (date ?? '');
  useReportUnsavedChanges(hasUnsavedChanges, onUnsavedChange);

  function handleSave() {
    return run(async () =>
      onSaved(await updatePlan(planId, { date: draftDate })),
    );
  }

  function handleRemove() {
    return run(async () => {
      const plan = await updatePlan(planId, { date: null });
      setDraftDate('');
      onSaved(plan);
    });
  }

  return (
    <div>
      <label>
        Date
        <input
          type="date"
          value={draftDate}
          onChange={(e) => setDraftDate(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={saving || draftDate === '' || !hasUnsavedChanges}
        onClick={handleSave}
      >
        Save date
      </button>
      {date && (
        <button type="button" disabled={saving} onClick={handleRemove}>
          Remove date
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
