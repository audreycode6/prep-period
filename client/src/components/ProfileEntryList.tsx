// One label-and-note entry while it's being edited. `key` identifies the row
// on screen, for React and for finding the entry to change, since profile
// entries are stored without ids.
export type EntryDraft = {
  key: string;
  label: string;
  note: string;
};

type Props = {
  heading: string;
  hint?: string;
  addLabel: string;
  entries: EntryDraft[];
  // what's wrong with each entry, in order; undefined when it can be saved
  validationMessages: (string | undefined)[];
  onChange: (entries: EntryDraft[]) => void;
};

/**
 * One of a profile's label-and-note lists: a label field, a note field and a
 * Remove button per entry, what's wrong with an entry that can't be saved,
 * and a button that adds a blank entry. Hands every change to `onChange` as
 * the whole list.
 */
export function ProfileEntryList({
  heading,
  hint,
  addLabel,
  entries,
  validationMessages,
  onChange,
}: Props) {
  function updateEntry(key: string, changes: Partial<EntryDraft>) {
    onChange(
      entries.map((entry) =>
        entry.key === key ? { ...entry, ...changes } : entry,
      ),
    );
  }

  return (
    <fieldset>
      <legend>{heading}</legend>
      {hint && <p>{hint}</p>}
      {entries.length > 0 && (
        <ul>
          {entries.map((entry, index) => (
            <li key={entry.key}>
              <input
                aria-label="Label"
                placeholder="Label"
                value={entry.label}
                onChange={(e) =>
                  updateEntry(entry.key, { label: e.target.value })
                }
              />
              <textarea
                aria-label="Note"
                placeholder="Note"
                value={entry.note}
                onChange={(e) =>
                  updateEntry(entry.key, { note: e.target.value })
                }
              />
              <button
                type="button"
                onClick={() =>
                  onChange(entries.filter((other) => other.key !== entry.key))
                }
              >
                Remove
              </button>
              {validationMessages[index] && <p>{validationMessages[index]}</p>}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...entries,
            { key: crypto.randomUUID(), label: '', note: '' },
          ])
        }
      >
        {addLabel}
      </button>
    </fieldset>
  );
}
