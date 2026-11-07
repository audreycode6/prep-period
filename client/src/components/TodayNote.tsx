import { useState } from 'react';
import type { Plan } from '@prep-period/shared';
import { updatePlan } from '../api/plans';
import { useRequest } from '../hooks/useRequest';

type Props = {
  planId: string;
  todayNote: string | null;
  onSaved: (plan: Plan) => void;
};

/**
 * Edits the plan's just-for-today note, saves it on Save note, and hands the
 * updated plan to `onSaved`.
 */
export function TodayNote({ planId, todayNote, onSaved }: Props) {
  const [note, setNote] = useState(todayNote ?? '');
  const { pending: saving, error, run } = useRequest();

  function handleSave() {
    return run(async () =>
      onSaved(await updatePlan(planId, { todayNote: note })),
    );
  }

  return (
    <div>
      <label>
        Notes for the day
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button type="button" disabled={saving} onClick={handleSave}>
        Save note
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
