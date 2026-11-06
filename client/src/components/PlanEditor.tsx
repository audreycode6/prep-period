import { useEffect, useState } from 'react';
import {
  overlappingBlockIds,
  type Block,
  type BlockUpdate,
  type Plan,
} from '@prep-period/shared';
import { deleteBlock, updateBlock } from '../api/blocks';
import { errorMessage } from '../api/client';
import { addBlock, deletePlan, getPlan, updatePlan } from '../api/plans';
import { BlockForm, type BlockFormValues } from './BlockForm';
import { PlanBlock } from './PlanBlock';
import { ProfileSelect } from './ProfileSelect';
import { joinWithAnd, pluralize } from '../text';
import { TodayNote } from './TodayNote';

type Props = {
  planId: string;
  onClose: () => void;
  onEditProfile: (profileId: string) => void;
  onNewProfile: () => void;
  // a profile just created from this plan, which the plan moves onto
  newProfileId?: string;
};

/**
 * Editor for one plan: its profile, today-note and blocks, with their
 * activities and annotations. Back to plans, and deleting the plan, call
 * `onClose`; the profile buttons call `onEditProfile` and `onNewProfile`.
 * Given `newProfileId`, moves the plan onto that profile as it loads.
 */
export function PlanEditor({
  planId,
  onClose,
  onEditProfile,
  onNewProfile,
  newProfileId,
}: Props) {
  // null until the first load answers
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  // the block whose edit form is open, or null when none is
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  useEffect(() => {
    const load =
      newProfileId === undefined
        ? getPlan(planId)
        : updatePlan(planId, { profileId: newProfileId });
    load.then(setPlan).catch((err: unknown) => setError(errorMessage(err)));
  }, [planId, newProfileId]);

  async function reload() {
    try {
      setPlan(await getPlan(planId));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleAdd(values: BlockFormValues) {
    await addBlock(planId, values);
    await reload();
  }

  /**
   * Saves an edited block: compares each form value with the block's saved
   * value and sends only the ones that differ, then reloads the plan and
   * closes the form. Sends no request when nothing changed.
   */
  async function handleEdit(block: Block, values: BlockFormValues) {
    const changes: BlockUpdate = {};
    if (values.title.trim() !== block.title) changes.title = values.title;
    // a blank field and a saved null both mean no description
    if ((values.description ?? '').trim() !== (block.description ?? ''))
      changes.description = values.description;
    if (values.startMinutes !== block.startMinutes)
      changes.startMinutes = values.startMinutes;
    if (values.endMinutes !== block.endMinutes)
      changes.endMinutes = values.endMinutes;

    if (Object.keys(changes).length > 0) {
      await updateBlock(block.id, changes);
      await reload();
    }
    setEditingBlockId(null);
  }

  /**
   * Asks for confirmation, naming how many activities and annotations will be
   * deleted with the block, then deletes it and reloads the plan. Cancel does
   * nothing.
   */
  async function handleDeleteBlock(block: Block) {
    const contents = [];
    if (block.activities.length > 0)
      contents.push(
        pluralize(block.activities.length, 'activity', 'activities'),
      );
    if (block.annotations.length > 0)
      contents.push(
        pluralize(block.annotations.length, 'annotation', 'annotations'),
      );
    const cascadeNote =
      contents.length === 0 ? '' : ` and its ${joinWithAnd(contents)}`;

    if (!window.confirm(`Delete the "${block.title}" block${cascadeNote}?`)) {
      return;
    }

    try {
      await deleteBlock(block.id);
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  /**
   * Asks for confirmation, naming how many blocks will be deleted with the
   * plan, along with their activities and annotations, then deletes it and
   * returns to the plan list. Cancel does nothing.
   */
  async function handleDeletePlan() {
    if (plan === null) return;
    const count = plan.blocks.length;
    const cascadeNote =
      count === 0
        ? ''
        : ` and its ${pluralize(count, 'block', 'blocks')} with their activities and annotations`;

    if (!window.confirm(`Delete the "${plan.title}" plan${cascadeNote}?`)) {
      return;
    }

    try {
      await deletePlan(plan.id);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  // ids of the blocks whose times overlap another block's
  const overlappingIds = plan
    ? overlappingBlockIds(plan.blocks)
    : new Set<string>();

  return (
    <section>
      <button type="button" onClick={onClose}>
        Back to plans
      </button>
      {error && <p role="alert">{error}</p>}
      {plan === null ? (
        !error && <p>Loading plan...</p>
      ) : (
        <>
          <h2>{plan.title}</h2>
          <button type="button" onClick={handleDeletePlan}>
            Delete plan
          </button>
          <h3>Add a block</h3>
          <BlockForm submitLabel="Add block" onSubmit={handleAdd} />
          {plan.date && <p>{plan.date}</p>}
          <ProfileSelect
            plan={plan}
            onSaved={setPlan}
            onNewProfile={onNewProfile}
          />
          {!plan.profile.isArchived && (
            <button
              type="button"
              onClick={() => onEditProfile(plan.profile.id)}
            >
              Edit profile
            </button>
          )}
          <TodayNote
            planId={plan.id}
            todayNote={plan.todayNote}
            onSaved={setPlan}
          />
          {plan.blocks.length === 0 ? (
            <p>No blocks yet.</p>
          ) : (
            <ol>
              {plan.blocks.map((block) => (
                <PlanBlock
                  key={block.id}
                  block={block}
                  isEditing={editingBlockId === block.id}
                  overlaps={overlappingIds.has(block.id)}
                  onEdit={() => setEditingBlockId(block.id)}
                  onCancelEdit={() => setEditingBlockId(null)}
                  onSave={(values) => handleEdit(block, values)}
                  onDelete={() => handleDeleteBlock(block)}
                  onContentSaved={reload}
                />
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
