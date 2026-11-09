import { useEffect, useEffectEvent, useState } from 'react';

// a callback a section calls with whether it has unsaved changes: whether
// what its Save would send differs from what's saved, or from blank for
// something new
export type OnUnsavedChange = (hasUnsavedChanges: boolean) => void;

/**
 * Calls `onUnsavedChange` with whether there are unsaved changes: when the
 * component first shows, each time that changes, and false once it's
 * removed from the page.
 */
export function useReportUnsavedChanges(
  hasUnsavedChanges: boolean,
  onUnsavedChange: OnUnsavedChange | undefined,
) {
  // uses the latest callback without re-running the effects on every render
  const callOnUnsavedChange = useEffectEvent((value: boolean) =>
    onUnsavedChange?.(value),
  );

  // separate effects so each runs on its own schedule: on change, on removal
  useEffect(() => {
    callOnUnsavedChange(hasUnsavedChanges);
  }, [hasUnsavedChanges]);

  // onUnsavedChange gets each change, and false once this section is no
  // longer on the page, so its lost edits stop counting as unsaved
  useEffect(() => () => callOnUnsavedChange(false), []);
}

/**
 * For a component made of sections that each report unsaved changes.
 * Returns:
 * - `onUnsavedChangeFor(key)`: the callback to give the section named `key`
 * - `hasUnsavedChanges`: true while any section has unsaved changes, for the
 *   component to show and report up
 * - `sectionHasUnsavedChanges(key)`: true while the section named `key` has
 *   unsaved changes, for when one section's edits matter to another
 */
export function useUnsavedSections() {
  const [unsavedKeys, setUnsavedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  function onUnsavedChangeFor(key: string): OnUnsavedChange {
    return (hasUnsavedChanges) =>
      setUnsavedKeys((current) => {
        // the same set back lets React skip a render when nothing changed
        if (current.has(key) === hasUnsavedChanges) return current;
        const next = new Set(current);
        if (hasUnsavedChanges) next.add(key);
        else next.delete(key);
        return next;
      });
  }

  function sectionHasUnsavedChanges(key: string) {
    return unsavedKeys.has(key);
  }

  return {
    hasUnsavedChanges: unsavedKeys.size > 0,
    hasUnsavedChangesIn: sectionHasUnsavedChanges,
    onUnsavedChangeFor,
  };
}
