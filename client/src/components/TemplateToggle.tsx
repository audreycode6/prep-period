import type { Plan } from '@prep-period/shared';
import { updatePlan } from '../api/plans';
import { useRequest } from '../hooks/useRequest';

type Props = {
  planId: string;
  isTemplate: boolean;
  onSaved: (plan: Plan) => void;
};

/**
 * A button that marks the plan as a template, or unmarks it when it is one,
 * and hands the updated plan to `onSaved`. A failed save shows its error
 * beside the button.
 */
export function TemplateToggle({ planId, isTemplate, onSaved }: Props) {
  const { pending: saving, error, run } = useRequest();

  function handleClick() {
    return run(async () =>
      onSaved(await updatePlan(planId, { isTemplate: !isTemplate })),
    );
  }

  return (
    <>
      <button type="button" disabled={saving} onClick={handleClick}>
        {isTemplate ? 'Unmark as template' : 'Mark as template'}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
