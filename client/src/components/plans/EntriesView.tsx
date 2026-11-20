import type { ProfileEntry } from '@prep-period/shared';

type Props = {
  entries: ProfileEntry[];
};

/**
 * Entries as a list of labels, each followed by its note.
 */
export function EntriesView({ entries }: Props) {
  return (
    <dl>
      {entries.map((entry, index) => (
        <div key={index}>
          <dt>{entry.label}</dt>
          <dd>{entry.note}</dd>
        </div>
      ))}
    </dl>
  );
}
