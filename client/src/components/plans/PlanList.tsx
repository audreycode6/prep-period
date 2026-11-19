import { useEffect, useState, type SubmitEvent } from 'react';
import type { ClassroomProfileSummary, PlanSummary } from '@prep-period/shared';
import { errorMessage } from '../../api/client';
import { createPlan, deletePlan, getPlans } from '../../api/plans';
import { getProfiles } from '../../api/profiles';
import { useRequest } from '../../hooks/useRequest';
import { useStoredPlanFilter } from '../../hooks/useStoredPlanFilter';
import { matchesFilter } from '../../planFilters';
import { TemplateFilter } from './TemplateFilter';

type Props = {
  onOpen: (planId: string) => void;
  onNewProfile: () => void;
  onDuplicate: (planId: string) => Promise<void>;
};

/**
 * The teacher's plans, which can be opened, duplicated or deleted, and a
 * form to create one, replaced by a request for a profile while there are
 * no live profiles. Creating a plan opens it through `onOpen`; a rejected
 * `onDuplicate` shows its error. While the list holds both templates and
 * other plans, it can be filtered by kind, remembering the last choice in
 * this browser.
 */
export function PlanList({ onOpen, onNewProfile, onDuplicate }: Props) {
  // null until the first load answers, so loading and an empty list differ
  const [plans, setPlans] = useState<PlanSummary[] | null>(null);
  // null while the profile list loads
  const [profiles, setProfiles] = useState<ClassroomProfileSummary[] | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chosenFilter, setChosenFilter] = useStoredPlanFilter();
  const [title, setTitle] = useState('');
  const { pending: creating, error: createError, run } = useRequest();
  const { pending: copying, error: copyError, run: runCopy } = useRequest();
  const {
    pending: deleting,
    error: deleteError,
    run: runDelete,
  } = useRequest();

  useEffect(() => {
    getPlans()
      .then(setPlans)
      .catch((err: unknown) => setLoadError(errorMessage(err)));
    getProfiles()
      .then(setProfiles)
      .catch((err: unknown) => setLoadError(errorMessage(err)));
  }, []);

  const hasTemplatesAndPlans =
    plans !== null &&
    plans.some((plan) => plan.isTemplate) &&
    plans.some((plan) => !plan.isTemplate);
  const shownFilter =
    plans && plans.some((plan) => matchesFilter(plan, chosenFilter))
      ? chosenFilter
      : 'all';

  async function handleCreate(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    await run(async () => {
      const plan = await createPlan({ title });
      onOpen(plan.id);
    });
  }

  /**
   * Asks for confirmation, then deletes the plan and removes it from the
   * list. Cancel does nothing.
   */
  function handleDelete(plan: PlanSummary) {
    if (!window.confirm(`Delete the "${plan.title}" plan and its content?`)) {
      return;
    }
    return runDelete(async () => {
      await deletePlan(plan.id);
      setPlans(
        (current) =>
          current && current.filter((listed) => listed.id !== plan.id),
      );
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
      {copyError && <p role="alert">{copyError}</p>}
      {deleteError && <p role="alert">{deleteError}</p>}
      {loadError && <p role="alert">{loadError}</p>}
      {plans === null ? (
        !loadError && <p>Loading plans...</p>
      ) : plans.length === 0 ? (
        <p>No plans yet.</p>
      ) : (
        <>
          {hasTemplatesAndPlans && (
            <TemplateFilter filter={shownFilter} onChange={setChosenFilter} />
          )}
          <ul>
            {plans
              .filter((plan) => matchesFilter(plan, shownFilter))
              .map((plan) => (
                <li key={plan.id}>
                  {plan.title}
                  {plan.isTemplate && ' · Template'}
                  {plan.date && ` · ${plan.date}`} · {plan.profile.name}
                  {plan.profile.isArchived && ' (archived)'}
                  {/* labels name the plan, since every row's buttons look
                      alike */}
                  <button
                    type="button"
                    aria-label={`Open "${plan.title}"`}
                    onClick={() => onOpen(plan.id)}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    aria-label={`Duplicate "${plan.title}"`}
                    disabled={copying}
                    onClick={() => runCopy(() => onDuplicate(plan.id))}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete "${plan.title}"`}
                    disabled={deleting}
                    onClick={() => handleDelete(plan)}
                  >
                    Delete
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}
    </section>
  );
}
