import { useState } from 'react';
import type { Activity, ActivityInputRequest } from '@prep-period/shared';
import { errorMessage } from '../api/client';
import { saveActivities } from '../api/plans';

// key identifies the draft on screen, since one added here has no id until
// it is saved
type ActivityDraft = ActivityInputRequest & { key: string };

type Props = { blockId: string; activities: Activity[] };

/**
 * Copies activities from the server into editable drafts, keeping each one's
 * id, steps and minutes alongside its label.
 */
function toDrafts(activities: Activity[]): ActivityDraft[] {
  return activities.map((activity) => ({ ...activity, key: activity.id }));
}

/**
 * Edits one block's activities as a list: add, rename and remove them, then
 * save the whole list. After a save the list is reset from the server's reply,
 * so new activities get their ids.
 */
export function BlockActivities({ blockId, activities }: Props) {
  const [drafts, setDrafts] = useState(() => toDrafts(activities));
  const [error, setError] = useState<string | null>(null);
  // true while a save is in flight, so a double click can't send it twice
  const [saving, setSaving] = useState(false);

  const canSave = !saving && drafts.every((draft) => draft.label.trim() !== '');

  function setLabel(key: string, label: string) {
    setDrafts((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, label } : draft)),
    );
  }

  function addDraft() {
    setDrafts((current) => [
      ...current,
      { key: crypto.randomUUID(), label: '' },
    ]);
  }

  function removeDraft(key: string) {
    setDrafts((current) => current.filter((draft) => draft.key !== key));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveActivities(
        blockId,
        drafts.map((draft) => ({
          id: draft.id,
          label: draft.label,
          steps: draft.steps,
          minutes: draft.minutes,
        })),
      );
      setDrafts(toDrafts(saved));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {drafts.length === 0 ? (
        <p>No activities yet.</p>
      ) : (
        <ul>
          {drafts.map((draft) => (
            <li key={draft.key}>
              <input
                aria-label="Activity"
                value={draft.label}
                onChange={(e) => setLabel(draft.key, e.target.value)}
              />
              <button type="button" onClick={() => removeDraft(draft.key)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={addDraft}>
        Add an activity
      </button>
      <button type="button" disabled={!canSave} onClick={handleSave}>
        Save block
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
