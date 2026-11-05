import { useState } from 'react';
import {
  activityInputSchema,
  activityMinutesOverBlockLength,
  formatDuration,
  type Activity,
  type ActivityInputRequest,
} from '@prep-period/shared';
import { errorMessage } from '../api/client';
import { saveActivities } from '../api/blocks';

// One activity's fields in the list while it's being edited. `key` identifies
// the row on screen, for React and for finding the draft to change, since a
// new activity has no `id` until it's saved. Minutes and steps hold the text
// as typed into their fields.
type ActivityDraft = {
  key: string;
  id?: string;
  label: string;
  minutesText: string;
  stepsText: string; // one step per line
};

type Props = {
  blockId: string;
  activities: Activity[];
  startMinutes: number;
  endMinutes: number;
};

/**
 * Converts saved activities into `ActivityDraft`s for editing: minutes become
 * text, empty when there are none, and each step goes on its own line.
 */
function toDrafts(activities: Activity[]): ActivityDraft[] {
  return activities.map((activity) => ({
    key: activity.id,
    id: activity.id,
    label: activity.label,
    minutesText: activity.minutes === null ? '' : String(activity.minutes),
    stepsText: activity.steps.map((step) => step.text).join('\n'),
  }));
}

/**
 * Converts a draft into the activity sent on save: empty minutes become null
 * (flexible), and each non-blank line of steps, trimmed, becomes one step.
 */
function toInput(draft: ActivityDraft): ActivityInputRequest {
  return {
    id: draft.id,
    label: draft.label,
    minutes: draft.minutesText.trim() === '' ? null : Number(draft.minutesText),
    steps: draft.stepsText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
      .map((text) => ({ text })),
  };
}

/**
 * Add, edit and remove a block's activities, then save them all
 * at once. Save is disabled while any activity is invalid, and that activity
 * shows what's wrong. A warning shows, without stopping the save, when the
 * activities' minutes add up to more than the block. After a save, the rows
 * reload from the saved list, so new activities have their ids.
 */
export function BlockActivities({
  blockId,
  activities,
  startMinutes,
  endMinutes,
}: Props) {
  const [drafts, setDrafts] = useState(() => toDrafts(activities));
  const [error, setError] = useState<string | null>(null);
  // true while a save is in flight, so a double click can't send it twice
  const [saving, setSaving] = useState(false);

  const inputs = drafts.map(toInput);
  const problems = inputs.map(
    (input) => activityInputSchema.safeParse(input).error?.issues[0]?.message,
  );
  const canSave = !saving && problems.every((problem) => problem === undefined);
  const minutesOver = activityMinutesOverBlockLength({
    startMinutes,
    endMinutes,
    activities: inputs.map((input) => ({ minutes: input.minutes ?? null })),
  });

  function updateDraft(key: string, changes: Partial<ActivityDraft>) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.key === key ? { ...draft, ...changes } : draft,
      ),
    );
  }

  function addDraft() {
    setDrafts((current) => [
      ...current,
      { key: crypto.randomUUID(), label: '', minutesText: '', stepsText: '' },
    ]);
  }

  function removeDraft(key: string) {
    setDrafts((current) => current.filter((draft) => draft.key !== key));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      setDrafts(toDrafts(await saveActivities(blockId, inputs)));
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
          {drafts.map((draft, index) => (
            <li key={draft.key}>
              <input
                aria-label="Activity"
                value={draft.label}
                onChange={(e) =>
                  updateDraft(draft.key, { label: e.target.value })
                }
              />
              <label>
                Minutes
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={draft.minutesText}
                  onChange={(e) =>
                    updateDraft(draft.key, { minutesText: e.target.value })
                  }
                />
              </label>
              <label>
                Steps, one per line
                <textarea
                  value={draft.stepsText}
                  onChange={(e) =>
                    updateDraft(draft.key, { stepsText: e.target.value })
                  }
                />
              </label>
              <button type="button" onClick={() => removeDraft(draft.key)}>
                Remove
              </button>
              {problems[index] && <p>{problems[index]}</p>}
            </li>
          ))}
        </ul>
      )}
      {minutesOver !== null && (
        <p>{`Activities run ${formatDuration(minutesOver)} over this block.`}</p>
      )}
      <button type="button" onClick={addDraft}>
        Add activity
      </button>
      <button type="button" disabled={!canSave} onClick={handleSave}>
        Save activities
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
