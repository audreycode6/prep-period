import { useEffect, useState, type SubmitEvent } from 'react';
import type { ClassroomProfileSummary, PlanSummary } from '@prep-period/shared';
import { errorMessage } from '../api/client';
import { createPlan, getPlans } from '../api/plans';
import { getProfiles } from '../api/profiles';
import { useRequest } from '../hooks/useRequest';

type Props = {
  onOpen: (planId: string) => void;
  onNewProfile: () => void;
};

/**
 * The teacher's plans, and a form to create one. Opening a plan, or creating
 * one, calls `onOpen` with its id; the new profile button calls
 * `onNewProfile`. With no live profiles, it asks for a profile instead of
 * offering a new plan.
 */
export function PlanList({ onOpen, onNewProfile }: Props) {
  // null until the first load answers, so loading and an empty list differ
  const [plans, setPlans] = useState<PlanSummary[] | null>(null);
  // null while the profile list loads
  const [profiles, setProfiles] = useState<ClassroomProfileSummary[] | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const { pending: creating, error: createError, run } = useRequest();

  useEffect(() => {
    getPlans()
      .then(setPlans)
      .catch((err: unknown) => setLoadError(errorMessage(err)));
    getProfiles()
      .then(setProfiles)
      .catch((err: unknown) => setLoadError(errorMessage(err)));
  }, []);

  async function handleCreate(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    await run(async () => {
      const plan = await createPlan({ title });
      onOpen(plan.id);
    });
  }

  return (
    <section>
      <h2>Plans</h2>
      <button type="button" onClick={onNewProfile}>
        New classroom profile
      </button>
      {profiles?.length === 0 ? (
        <p>
          Every plan uses a classroom profile. Create one to start planning.
        </p>
      ) : (
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
      )}
      {createError && <p role="alert">{createError}</p>}
      {loadError && <p role="alert">{loadError}</p>}
      {plans === null ? (
        !loadError && <p>Loading plans...</p>
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
