import { useEffect, useState } from 'react';
import { minutesToDisplay, type Plan } from '@prep-period/shared';
import { errorMessage } from '../api/client';
import { getPlan } from '../api/plans';
import { BlockActivities } from './BlockActivities';
import { BlockForm } from './BlockForm';

type Props = { planId: string; onClose: () => void };

/**
 * Shows one plan with its blocks, each with its activities, and a form to add
 * a block. After a block is added it fetches the plan again rather than
 * inserting the block itself, so blocks always show in the server's order.
 */
export function PlanEditor({ planId, onClose }: Props) {
  // null until the first load answers
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

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
                  <h3>
                    {minutesToDisplay(block.startMinutes)}–
                    {minutesToDisplay(block.endMinutes)} {block.title}
                  </h3>
                  <BlockActivities
                    blockId={block.id}
                    activities={block.activities}
                  />
                </li>
              ))}
            </ol>
          )}
          <BlockForm planId={plan.id} onAdded={reload} />
        </>
      )}
    </section>
  );
}
