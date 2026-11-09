import {
  activityInputSchema,
  activityMinutesOverBlockLength,
  durationInputToMinutes,
  formatDuration,
  type Activity,
  type ActivityInputRequest,
  type Annotation,
} from '@prep-period/shared';
import { saveActivities } from '../api/blocks';
import type { OnUnsavedChange } from '../hooks/unsavedChanges';
import { useDraftList } from '../hooks/useDraftList';
import { joinWithAnd, pluralize } from '../text';
import { ActivityRow, type ActivityDraft } from './ActivityRow';

type Props = {
  blockId: string;
  activities: Activity[];
  startMinutes: number;
  endMinutes: number;
  // the block's saved annotations, to name the ones removed with an activity
  annotations: Annotation[];
  // a save that adds or removes an activity clears these edits
  annotationsHaveUnsavedChanges: boolean;
  // called after a save, so the plan can reload what depends on the activities
  onSaved: () => void;
  onUnsavedChange?: OnUnsavedChange;
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
 * (flexible), minutes that aren't only digits become a value validation
 * rejects as not a whole number, and each non-blank line of steps, trimmed,
 * becomes one step.
 */
function toInput(draft: ActivityDraft): ActivityInputRequest {
  return {
    id: draft.id,
    label: draft.label,
    minutes: durationInputToMinutes(draft.minutesText),
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
 * reload from the saved list, so new activities have their ids, and
 * `onSaved` is called.
 */
export function BlockActivities({
  blockId,
  activities,
  startMinutes,
  endMinutes,
  annotations,
  annotationsHaveUnsavedChanges,
  onSaved,
  onUnsavedChange,
}: Props) {
  const list = useDraftList({
    initialDrafts: toDrafts(activities),
    toInput,
    validate: (activity) =>
      activityInputSchema.safeParse(activity).error?.issues[0]?.message,
    saveInputs: async (inputs) =>
      toDrafts(await saveActivities(blockId, inputs)),
    onSaved,
    onUnsavedChange,
  });

  const minutesOver = activityMinutesOverBlockLength({
    startMinutes,
    endMinutes,
    activities: list.inputs.map((activity) => ({
      minutes: activity.minutes ?? null,
    })),
  });

  function addDraft() {
    list.add({
      key: crypto.randomUUID(),
      label: '',
      minutesText: '',
      stepsText: '',
    });
  }

  /**
   * Removes the draft, asking first when it's a saved activity or has steps,
   * and naming its steps and annotations when it has some. A new activity
   * with no steps is removed without asking. Cancel keeps it.
   */
  function confirmRemove(draft: ActivityDraft) {
    const hasSteps = draft.stepsText.trim() !== '';
    if (draft.id === undefined && !hasSteps) {
      list.remove(draft.key);
      return;
    }
    const annotationCount = annotations.filter(
      (annotation) => annotation.activityId === draft.id,
    ).length;
    const contents = [];
    if (hasSteps) contents.push('steps');
    if (annotationCount > 0)
      contents.push(pluralize(annotationCount, 'annotation', 'annotations'));
    const contentsNote =
      contents.length === 0 ? '' : ` and its ${joinWithAnd(contents)}`;
    if (window.confirm(`Remove this activity${contentsNote}?`)) {
      list.remove(draft.key);
    }
  }

  /**
   * Saves the activities, asking first when the save adds or removes an
   * activity while annotations have unsaved edits. Cancel keeps both lists as
   * they are.
   */
  function confirmSave() {
    const addsOrRemovesActivities =
      list.drafts.some((draft) => draft.id === undefined) ||
      list.drafts.length !== activities.length;
    if (
      annotationsHaveUnsavedChanges &&
      addsOrRemovesActivities &&
      !window.confirm(
        "Saving activities will clear this block's unsaved annotation " +
          'edits. Save anyway?',
      )
    ) {
      return;
    }
    list.save();
  }

  return (
    <div>
      {list.drafts.length === 0 ? (
        <p>No activities yet.</p>
      ) : (
        <ul>
          {list.drafts.map((draft, index) => (
            <ActivityRow
              key={draft.key}
              draft={draft}
              validationMessage={list.validationMessages[index]}
              onChange={(changes) => list.update(draft.key, changes)}
              onRemove={() => confirmRemove(draft)}
            />
          ))}
        </ul>
      )}
      {minutesOver !== null && (
        <p>{`Activities run ${formatDuration(minutesOver)} over this block.`}</p>
      )}
      <button type="button" onClick={addDraft}>
        Add activity
      </button>
      <button type="button" disabled={!list.canSave} onClick={confirmSave}>
        Save activities
      </button>
      {list.error && <p role="alert">{list.error}</p>}
    </div>
  );
}
