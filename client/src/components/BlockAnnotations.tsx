import {
  annotationInputSchema,
  type Activity,
  type Annotation,
  type AnnotationInputRequest,
} from '@prep-period/shared';
import { saveAnnotations } from '../api/blocks';
import { useDraftList } from '../hooks/useDraftList';
import { AnnotationRow, type AnnotationDraft } from './AnnotationRow';

type Props = {
  blockId: string;
  annotations: Annotation[];
  // the block's saved activities, so an annotation can be tied to one of them
  activities: Activity[];
  // called after a save, so the plan's copy of the annotations stays current
  onSaved: () => void;
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
 * saved list and `onSaved` is called.
 */
export function BlockAnnotations({
  blockId,
  annotations,
  activities,
  onSaved,
}: Props) {
  const list = useDraftList({
    initialDrafts: toDrafts(annotations),
    toInput,
    validate: (annotation) =>
      annotationInputSchema.safeParse(annotation).error?.issues[0]?.message,
    saveInputs: async (inputs) =>
      toDrafts(await saveAnnotations(blockId, inputs)),
    onSaved,
  });

  function addDraft() {
    list.add({
      key: crypto.randomUUID(),
      activityId: '',
      type: 'good_to_know',
      text: '',
    });
  }

  /**
   * Removes the draft, asking first when it's a saved annotation or has
   * text. A new annotation with no text is removed without asking. Cancel
   * keeps it.
   */
  function confirmRemove(draft: AnnotationDraft) {
    const hasText = draft.text.trim() !== '';
    if (draft.id === undefined && !hasText) {
      list.remove(draft.key);
      return;
    }
    if (window.confirm('Remove this annotation?')) {
      list.remove(draft.key);
    }
  }

  return (
    <div>
      {list.drafts.length === 0 ? (
        <p>No annotations yet.</p>
      ) : (
        <ul>
          {list.drafts.map((draft, index) => (
            <AnnotationRow
              key={draft.key}
              draft={draft}
              activities={activities}
              validationMessage={list.validationMessages[index]}
              onChange={(changes) => list.update(draft.key, changes)}
              onRemove={() => confirmRemove(draft)}
            />
          ))}
        </ul>
      )}
      <button type="button" onClick={addDraft}>
        Add annotation
      </button>
      <button type="button" disabled={!list.canSave} onClick={list.save}>
        Save annotations
      </button>
      {list.error && <p role="alert">{list.error}</p>}
    </div>
  );
}
