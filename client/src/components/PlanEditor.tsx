import { useEffect, useState } from 'react';
import {
  minutesToDisplay,
  type Block,
  type BlockUpdate,
  type Plan,
} from '@prep-period/shared';
import { deleteBlock, updateBlock } from '../api/blocks';
import { errorMessage } from '../api/client';
import { addBlock, deletePlan, getPlan } from '../api/plans';
import { BlockActivities } from './BlockActivities';
import { BlockForm, type BlockFormValues } from './BlockForm';

type Props = { planId: string; onClose: () => void };

/**
 * Returns a count with the right form of the word, for the delete confirms
 */
function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Editor for one plan: renders its blocks and activities, adds and deletes
 * blocks, edits one block's title and times at a time, and deletes the plan.
 * Refetches the plan after each change so blocks stay sorted by start time.
 */
export function PlanEditor({ planId, onClose }: Props) {
  // null until the first load answers
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  // the block whose edit form is open, or null when none is
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  useEffect(() => {
    getPlan(planId)
      .then(setPlan)
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [planId]);

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
   * Asks for confirmation, naming how many activities will be deleted with
   * the block, then deletes it and reloads the plan. Cancel does nothing.
   */
  async function handleDeleteBlock(block: Block) {
    const count = block.activities.length;
    const cascadeNote =
      count === 0
        ? ''
        : ` and its ${pluralize(count, 'activity', 'activities')}`;

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
   * plan, then deletes it and returns to the plan list. Cancel does nothing.
   */
  async function handleDeletePlan() {
    if (plan === null) return;
    const count = plan.blocks.length;
    const cascadeNote =
      count === 0
        ? ''
        : ` and its ${pluralize(count, 'block', 'blocks')} with their activities`;

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
          <p>
            {plan.date && `${plan.date} · `}
            {plan.profile.name}
          </p>
          {plan.blocks.length === 0 ? (
            <p>No blocks yet.</p>
          ) : (
            <ol>
              {plan.blocks.map((block) => (
                <li key={block.id}>
                  {editingBlockId === block.id ? (
                    <BlockForm
                      blockToEdit={block}
                      submitLabel="Save"
                      onSubmit={(values) => handleEdit(block, values)}
                      onCancel={() => setEditingBlockId(null)}
                    />
                  ) : (
                    <>
                      <h3>
                        {minutesToDisplay(block.startMinutes)}–
                        {minutesToDisplay(block.endMinutes)} {block.title}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setEditingBlockId(block.id)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBlock(block)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                  <BlockActivities
                    blockId={block.id}
                    activities={block.activities}
                  />
                </li>
              ))}
            </ol>
          )}
          <h3>Add a block</h3>
          <BlockForm submitLabel="Add block" onSubmit={handleAdd} />
        </>
      )}
    </section>
  );
}
