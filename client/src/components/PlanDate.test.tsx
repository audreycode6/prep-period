import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Plan } from '@prep-period/shared';
import { ApiError } from '../api/client';
import { updatePlan } from '../api/plans';
import { PlanDate } from './PlanDate';

vi.mock('../api/plans');

const PLAN_ID = 'plan-1';

/**
 * A plan with only the fields PlanDate reads.
 */
function planDated(date: string | null) {
  return { id: PLAN_ID, date } as Plan;
}

/**
 * Renders PlanDate for a plan with `date`, and returns its callbacks along
 * with RTL's render result.
 */
function renderPlanDate(date: string | null) {
  const onSaved = vi.fn();
  const onUnsavedChange = vi.fn();
  const result = render(
    <PlanDate
      planId={PLAN_ID}
      date={date}
      onSaved={onSaved}
      onUnsavedChange={onUnsavedChange}
    />,
  );
  return { ...result, onSaved, onUnsavedChange };
}

describe('PlanDate', () => {
  it("shows the plan's date", () => {
    renderPlanDate('2026-11-20');
    expect(screen.getByLabelText('Date')).toHaveValue('2026-11-20');
  });

  it('shows an empty input for a plan with no date', () => {
    renderPlanDate(null);
    expect(screen.getByLabelText('Date')).toHaveValue('');
  });

  it('saves the chosen date and hands the saved plan to onSaved', async () => {
    const user = userEvent.setup();
    const saved = planDated('2026-11-21');
    vi.mocked(updatePlan).mockResolvedValue(saved);
    const { onSaved } = renderPlanDate('2026-11-20');

    const input = screen.getByLabelText('Date');
    await user.clear(input);
    await user.type(input, '2026-11-21');
    await user.click(screen.getByRole('button', { name: 'Save date' }));

    expect(updatePlan).toHaveBeenCalledWith(PLAN_ID, { date: '2026-11-21' });
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it('disables Save date while the input holds no date', async () => {
    const user = userEvent.setup();
    renderPlanDate(null);
    const saveButton = screen.getByRole('button', { name: 'Save date' });
    expect(saveButton).toBeDisabled();

    const input = screen.getByLabelText('Date');
    await user.type(input, '2026-11-20');
    expect(saveButton).toBeEnabled();

    await user.clear(input);
    expect(saveButton).toBeDisabled();
  });

  it('disables Save date while the date in the input matches the saved date', async () => {
    const user = userEvent.setup();
    renderPlanDate('2026-11-20');
    const saveButton = screen.getByRole('button', { name: 'Save date' });
    expect(saveButton).toBeDisabled();

    const input = screen.getByLabelText('Date');
    await user.clear(input);
    await user.type(input, '2026-11-21');
    expect(saveButton).toBeEnabled();

    await user.clear(input);
    await user.type(input, '2026-11-20');
    expect(saveButton).toBeDisabled();
  });

  it('saves null on Remove date and empties the input', async () => {
    const user = userEvent.setup();
    const saved = planDated(null);
    vi.mocked(updatePlan).mockResolvedValue(saved);
    const { onSaved } = renderPlanDate('2026-11-20');

    await user.click(screen.getByRole('button', { name: 'Remove date' }));

    expect(updatePlan).toHaveBeenCalledWith(PLAN_ID, { date: null });
    expect(onSaved).toHaveBeenCalledWith(saved);
    expect(screen.getByLabelText('Date')).toHaveValue('');
  });

  it('shows Remove date only while the plan has a date', () => {
    const { rerender } = renderPlanDate('2026-11-20');
    expect(
      screen.getByRole('button', { name: 'Remove date' }),
    ).toBeInTheDocument();

    rerender(<PlanDate planId={PLAN_ID} date={null} onSaved={vi.fn()} />);
    expect(
      screen.queryByRole('button', { name: 'Remove date' }),
    ).not.toBeInTheDocument();
  });

  it('reports an unsaved change while the input differs from the saved date', async () => {
    const user = userEvent.setup();
    vi.mocked(updatePlan).mockResolvedValue(planDated('2026-11-21'));
    const { onSaved, onUnsavedChange, rerender } = renderPlanDate(null);
    expect(onUnsavedChange).toHaveBeenLastCalledWith(false);

    await user.type(screen.getByLabelText('Date'), '2026-11-21');
    expect(onUnsavedChange).toHaveBeenLastCalledWith(true);

    await user.click(screen.getByRole('button', { name: 'Save date' }));
    // the editor passes the saved plan's date back down
    rerender(
      <PlanDate
        planId={PLAN_ID}
        date="2026-11-21"
        onSaved={onSaved}
        onUnsavedChange={onUnsavedChange}
      />,
    );
    expect(onUnsavedChange).toHaveBeenLastCalledWith(false);
  });

  it("shows the server's error when a save fails", async () => {
    const user = userEvent.setup();
    vi.mocked(updatePlan).mockRejectedValue(
      new ApiError(400, { error: 'Invalid date' }, 'PATCH failed: 400'),
    );
    const { onSaved } = renderPlanDate(null);

    await user.type(screen.getByLabelText('Date'), '2026-11-20');
    await user.click(screen.getByRole('button', { name: 'Save date' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid date');
    expect(onSaved).not.toHaveBeenCalled();
  });
});
