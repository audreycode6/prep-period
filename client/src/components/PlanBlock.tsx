import { minutesToDisplay, type Block } from '@prep-period/shared';
import { BlockActivities } from './BlockActivities';
import { BlockAnnotations } from './BlockAnnotations';
import { BlockForm, type BlockFormValues } from './BlockForm';

type Props = {
  block: Block;
  // true while this block's edit form is open
  isEditing: boolean;
  // true when the block's time overlaps another block's
  overlaps: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (values: BlockFormValues) => Promise<void>;
  onDelete: () => void;
  onActivitiesSaved: () => void;
};

/**
 * One block in a plan: its times, title, description and a warning when its
 * time overlaps another block's, with Edit and Delete buttons, or its edit
 * form while it's being edited. Its activities and annotations show below
 * either way.
 */
export function PlanBlock({
  block,
  isEditing,
  overlaps,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onActivitiesSaved,
}: Props) {
  return (
    <li>
      {isEditing ? (
        <BlockForm
          blockToEdit={block}
          submitLabel="Save block"
          onSubmit={onSave}
          onCancel={onCancelEdit}
        />
      ) : (
        <>
          <h3>
            {minutesToDisplay(block.startMinutes)}–
            {minutesToDisplay(block.endMinutes)} {block.title}
          </h3>
          {overlaps && <p>Overlaps another block</p>}
          {block.description && <p>{block.description}</p>}
          <button type="button" onClick={onEdit}>
            Edit
          </button>
          <button type="button" onClick={onDelete}>
            Delete block
          </button>
        </>
      )}
      <BlockActivities
        blockId={block.id}
        activities={block.activities}
        startMinutes={block.startMinutes}
        endMinutes={block.endMinutes}
        onSaved={onActivitiesSaved}
      />
      <BlockAnnotations
        // the key changes when the block's activities change, so
        // the annotation list reloads from what's saved and keeps
        // only annotations on activities that still exist
        key={block.activities.map((activity) => activity.id).join()}
        blockId={block.id}
        annotations={block.annotations}
        activities={block.activities}
      />
    </li>
  );
}
