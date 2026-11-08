import { useState } from 'react';
import {
  useReportUnsavedChanges,
  type OnUnsavedChange,
} from './unsavedChanges';
import { useRequest } from './useRequest';

type Options<Draft extends { key: string }, Input> = {
  initialDrafts: Draft[];
  // converts a draft into what's sent on save
  toInput: (draft: Draft) => Input;
  // the first problem with an input, or undefined when it's valid
  validate: (input: Input) => string | undefined;
  // saves the inputs, in order, and returns drafts of what was saved
  saveInputs: (inputs: Input[]) => Promise<Draft[]>;
  onSaved: () => void;
  onUnsavedChange?: OnUnsavedChange;
};

/**
 * A list of drafts that are updated, added and removed, then saved all at
 * once. Each draft gets a validation message, and saving is blocked while
 * any is invalid. A successful save replaces the drafts with what was saved
 * and calls `onSaved`; a failed one keeps the drafts.
 */
export function useDraftList<Draft extends { key: string }, Input>({
  initialDrafts,
  toInput,
  validate,
  saveInputs,
  onSaved,
  onUnsavedChange,
}: Options<Draft, Input>) {
  const [drafts, setDrafts] = useState(initialDrafts);
  // what was last saved, as it would be sent, to compare the drafts against
  const [savedInputs, setSavedInputs] = useState(() =>
    initialDrafts.map(toInput),
  );
  const { pending: saving, error, run } = useRequest();

  const inputs = drafts.map(toInput);
  const validationMessages = inputs.map(validate);
  const canSave =
    !saving && validationMessages.every((message) => message === undefined);
  const hasUnsavedChanges =
    JSON.stringify(inputs) !== JSON.stringify(savedInputs);
  useReportUnsavedChanges(hasUnsavedChanges, onUnsavedChange);

  function update(key: string, changes: Partial<Draft>) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.key === key ? { ...draft, ...changes } : draft,
      ),
    );
  }

  function add(draft: Draft) {
    setDrafts((current) => [...current, draft]);
  }

  function remove(key: string) {
    setDrafts((current) => current.filter((draft) => draft.key !== key));
  }

  function save() {
    return run(async () => {
      const savedDrafts = await saveInputs(inputs);
      setDrafts(savedDrafts);
      setSavedInputs(savedDrafts.map(toInput));
      onSaved();
    });
  }

  return {
    drafts,
    inputs,
    validationMessages,
    canSave,
    error,
    update,
    add,
    remove,
    save,
  };
}
