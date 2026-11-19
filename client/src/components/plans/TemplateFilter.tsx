import { PLAN_FILTERS, type PlanFilter } from '../../planFilters';

type Props = {
  filter: PlanFilter;
  onChange: (filter: PlanFilter) => void;
};

const FILTER_LABELS: Record<PlanFilter, string> = {
  all: 'All',
  plans: 'Plans',
  templates: 'Templates',
};

/**
 * Radio buttons choosing which plans a list shows, with `filter` checked.
 * `onChange` fires with the filter chosen.
 */
export function TemplateFilter({ filter, onChange }: Props) {
  return (
    <fieldset>
      <legend>Show</legend>
      {PLAN_FILTERS.map((option) => (
        <label key={option}>
          <input
            type="radio"
            name="planFilter"
            checked={filter === option}
            onChange={() => onChange(option)}
          />
          {FILTER_LABELS[option]}
        </label>
      ))}
    </fieldset>
  );
}
