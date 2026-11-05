import { useState } from 'react';
import type { Plan } from '@prep-period/shared';
import { errorMessage } from '../api/client';
import { updatePlan } from '../api/plans';

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
  const [error, setError] = useState<string | null>(null);
  // true while a save is in flight, so a double click can't send it twice
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      onSaved(await updatePlan(planId, { todayNote: note }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
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
