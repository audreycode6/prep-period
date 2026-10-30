import { useEffect, useState, type SubmitEvent } from 'react';
import type { PlanSummary } from '@prep-period/shared';
import { ApiError } from '../api/client';
import { createPlan, getPlans } from '../api/plans';

/**
 * Turns a failed request into a message for the screen: a 401 as not signed
 * in, otherwise the server's error when it sent one.
 */
function errorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 401) return 'Not signed in.';
  if (err instanceof ApiError && err.body) return err.body.error;
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/**
 * Lists the teacher's plans with their profile, and creates a new plan on the
 * default profile from a title.
 */
export function PlanList() {
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
      await createPlan({ title });
      setTitle('');
      setPlans(await getPlans());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
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
              {plan.title}
              {plan.date && ` · ${plan.date}`} · {plan.profile.name}
              {plan.profile.isArchived && ' (archived)'}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
