// One activity's fields in the list while it's being edited. `key` identifies
// the row on screen, for React and for finding the draft to change, since a
// new activity has no `id` until it's saved. Minutes and steps hold the text
// as typed into their fields.
export type ActivityDraft = {
  key: string;
  id?: string;
  label: string;
  minutesText: string;
  stepsText: string; // one step per line
};

type Props = {
  draft: ActivityDraft;
  // what's wrong with the draft, or undefined when it can be saved
  validationMessage: string | undefined;
  onChange: (changes: Partial<ActivityDraft>) => void;
  onRemove: () => void;
};

/**
 * One activity in a block's list: its label, minutes and steps fields, a
 * Remove button, and what's wrong with it when it can't be saved.
 */
export function ActivityRow({
  draft,
  validationMessage,
  onChange,
  onRemove,
}: Props) {
  return (
    <li>
      <input
        aria-label="Activity"
        placeholder="Cool Activity Name"
        value={draft.label}
        onChange={(e) => onChange({ label: e.target.value })}
      />
      <label>
        Minutes
        <input
          type="number"
          min={1}
          step={1}
          placeholder="Leave empty if flexible"
          value={draft.minutesText}
          onChange={(e) => onChange({ minutesText: e.target.value })}
        />
      </label>
      <label>
        Steps
        <textarea
          placeholder="Press Enter to separate steps"
          value={draft.stepsText}
          onChange={(e) => onChange({ stepsText: e.target.value })}
        />
      </label>
      <button type="button" onClick={onRemove}>
        Remove
      </button>
      {validationMessage && <p>{validationMessage}</p>}
    </li>
  );
}
