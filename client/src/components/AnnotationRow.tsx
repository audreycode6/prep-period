import {
  annotationTypeSchema,
  type Activity,
  type AnnotationType,
} from '@prep-period/shared';
import { ANNOTATION_TYPE_LABELS } from '../annotationTypes';

// One annotation's fields in the list while it's being edited. `key`
// identifies the row on screen, for React and for finding the draft to change,
// since a new annotation has no `id` until it's saved.
export type AnnotationDraft = {
  key: string;
  id?: string;
  // set when the annotation is about one activity; '' when it's about the
  // whole block
  activityId: string;
  type: AnnotationType;
  text: string;
};

type Props = {
  draft: AnnotationDraft;
  // the block's saved activities, so an annotation can be tied to one of them
  activities: Activity[];
  // what's wrong with the draft, or undefined when it can be saved
  validationMessage: string | undefined;
  onChange: (changes: Partial<AnnotationDraft>) => void;
  onRemove: () => void;
};

/**
 * One annotation in a block's list: its type, what it's about (the whole
 * block or one activity), its text, a Remove button, and what's wrong with
 * it when it can't be saved.
 */
export function AnnotationRow({
  draft,
  activities,
  validationMessage,
  onChange,
  onRemove,
}: Props) {
  return (
    <li>
      <select
        aria-label="Annotation type"
        value={draft.type}
        onChange={(e) =>
          onChange({ type: annotationTypeSchema.parse(e.target.value) })
        }
      >
        {annotationTypeSchema.options.map((type) => (
          <option key={type} value={type}>
            {ANNOTATION_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
      <select
        aria-label="About"
        value={draft.activityId}
        onChange={(e) => onChange({ activityId: e.target.value })}
      >
        <option value="">Whole block</option>
        {activities.map((activity) => (
          <option key={activity.id} value={activity.id}>
            {activity.label}
          </option>
        ))}
      </select>
      <textarea
        aria-label="Annotation text"
        placeholder="Annotation text"
        value={draft.text}
        onChange={(e) => onChange({ text: e.target.value })}
      />
      <button type="button" onClick={onRemove}>
        Remove
      </button>
      {validationMessage && <p>{validationMessage}</p>}
    </li>
  );
}
