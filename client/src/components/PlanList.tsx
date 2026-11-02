import { useEffect, useState, type SubmitEvent } from 'react';
import type { PlanSummary } from '@prep-period/shared';
import { errorMessage } from '../api/client';
import { createPlan, getPlans } from '../api/plans';

type Props = { onOpen: (planId: string) => void };

/**
 * Lists the teacher's plans with their profile and opens one when its title is
 * clicked. Creates a new plan on the default profile from a title and opens it.
 */
export function PlanList({ onOpen }: Props) {
  // null until the first load answers, so loading and an empty list differ
  const [plans, setPlans] = useState<PlanSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  // true while a create is in flight, so a double click can't make two plans
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getPlans()
      .then(setPlans)
      .catch((err: unknown) => setError(errorMessage(err)));
  }, []);

  async function handleCreate(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const plan = await createPlan({ title });
      onOpen(plan.id);
    } catch (err) {
      setError(errorMessage(err));
      setCreating(false);
    }
  }

  return (
    <section>
      <h2>Plans</h2>
      <form onSubmit={handleCreate}>
        <label>
          Title
          <input
            value={title}
            maxLength={255}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <button type="submit" disabled={creating || title.trim() === ''}>
          New plan
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {plans === null ? (
        !error && <p>Loading plans...</p>
      ) : plans.length === 0 ? (
        <p>No plans yet.</p>
      ) : (
        <ul>
          {plans.map((plan) => (
            <li key={plan.id}>
              <button type="button" onClick={() => onOpen(plan.id)}>
                {plan.title}
              </button>
              {plan.date && ` · ${plan.date}`} · {plan.profile.name}
              {plan.profile.isArchived && ' (archived)'}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
