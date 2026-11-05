import { useState } from 'react';
import {
  annotationInputSchema,
  type Activity,
  type Annotation,
  type AnnotationInputRequest,
} from '@prep-period/shared';
import { errorMessage } from '../api/client';
import { saveAnnotations } from '../api/blocks';
import { AnnotationRow, type AnnotationDraft } from './AnnotationRow';

type Props = {
  blockId: string;
  annotations: Annotation[];
  // the block's saved activities, so an annotation can be tied to one of them
  activities: Activity[];
};

/**
 * Converts saved annotations into `AnnotationDraft`s for editing: an
 * annotation about the whole block gets '' as its `activityId`.
 */
function toDrafts(annotations: Annotation[]): AnnotationDraft[] {
  return annotations.map((annotation) => ({
    key: annotation.id,
    id: annotation.id,
    activityId: annotation.activityId ?? '',
    type: annotation.type,
    text: annotation.text,
  }));
}

/**
 * Converts a draft into the annotation sent on save: an `activityId` of ''
 * becomes null, meaning the whole block.
 */
function toInput(draft: AnnotationDraft): AnnotationInputRequest {
  return {
    activityId: draft.activityId === '' ? null : draft.activityId,
    type: draft.type,
    text: draft.text,
  };
}

/**
 * Add, edit and remove a block's annotations, then save them all at once, in
 * the order listed. Save is disabled while any annotation is invalid, and
 * that annotation shows what's wrong. After a save, the rows reload from the
 * saved list.
 */
export function BlockAnnotations({ blockId, annotations, activities }: Props) {
  const [drafts, setDrafts] = useState(() => toDrafts(annotations));
  const [error, setError] = useState<string | null>(null);
  // true while a save is in flight, so a double click can't send it twice
  const [saving, setSaving] = useState(false);

  const annotationsToSave = drafts.map(toInput);
  const validationMessages = annotationsToSave.map(
    (annotation) =>
      annotationInputSchema.safeParse(annotation).error?.issues[0]?.message,
  );
  const canSave =
    !saving && validationMessages.every((message) => message === undefined);

  function updateDraft(key: string, changes: Partial<AnnotationDraft>) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.key === key ? { ...draft, ...changes } : draft,
      ),
    );
  }

  function addDraft() {
    setDrafts((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        activityId: '',
        type: 'good_to_know',
        text: '',
      },
    ]);
  }

  function removeDraft(key: string) {
    setDrafts((current) => current.filter((draft) => draft.key !== key));
  }

  /**
   * Removes the draft, asking first when it's a saved annotation or has
   * text. A new annotation with no text is removed without asking. Cancel
   * keeps it.
   */
  function confirmRemove(draft: AnnotationDraft) {
    const hasText = draft.text.trim() !== '';
    if (draft.id === undefined && !hasText) {
      removeDraft(draft.key);
      return;
    }
    if (window.confirm('Remove this annotation?')) {
      removeDraft(draft.key);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      setDrafts(toDrafts(await saveAnnotations(blockId, annotationsToSave)));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {drafts.length === 0 ? (
        <p>No annotations yet.</p>
      ) : (
        <ul>
          {drafts.map((draft, index) => (
            <AnnotationRow
              key={draft.key}
              draft={draft}
              activities={activities}
              validationMessage={validationMessages[index]}
              onChange={(changes) => updateDraft(draft.key, changes)}
              onRemove={() => confirmRemove(draft)}
            />
          ))}
        </ul>
      )}
      <button type="button" onClick={addDraft}>
        Add annotation
      </button>
      <button type="button" disabled={!canSave} onClick={handleSave}>
        Save annotations
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
