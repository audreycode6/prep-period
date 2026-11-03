import { useEffect, useState } from 'react';
import {
  minutesToDisplay,
  type Block,
  type BlockUpdate,
  type Plan,
} from '@prep-period/shared';
import { updateBlock } from '../api/blocks';
import { errorMessage } from '../api/client';
import { addBlock, getPlan } from '../api/plans';
import { BlockActivities } from './BlockActivities';
import { BlockForm, type BlockFormValues } from './BlockForm';

type Props = { planId: string; onClose: () => void };

/**
 * Editor for one plan: renders its blocks and activities, adds blocks, and
 * edits one block's title and times at a time. Refetches the plan after each
 * change so blocks stay sorted by start time.
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
