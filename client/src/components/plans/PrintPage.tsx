import { useEffect, useState } from 'react';
import type { Plan } from '@prep-period/shared';
import { errorMessage } from '../../api/client';
import { getPlan } from '../../api/plans';
import { PlanView } from './PlanView';

type Props = {
  planId: string;
  onClose: () => void;
};

/**
 * The saved plan, ready to print. Print stays disabled until the plan loads,
 * and from then until the page closes the tab's title is the plan's title.
 * Shows an error when the plan fails to load.
 */
export function PrintPage({ planId, onClose }: Props) {
  // null until the load answers
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPlan(planId)
      .then(setPlan)
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [planId]);

  // browsers suggest the page's title as a saved PDF's file name
  useEffect(() => {
    if (plan === null) return;
    const appTitle = document.title;
    document.title = plan.title;
    return () => {
      document.title = appTitle;
    };
  }, [plan]);

  return (
    <section>
      <div className="screen-only">
        <button type="button" onClick={onClose}>
          Back to plan
        </button>
        <button
          type="button"
          disabled={plan === null}
          onClick={() => window.print()}
        >
          Print
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {plan === null ? (
        !error && <p>Loading plan...</p>
      ) : (
        <PlanView plan={plan} />
      )}
    </section>
  );
}
