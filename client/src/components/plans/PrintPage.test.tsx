import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Plan } from '@prep-period/shared';
import { getPlan } from '../../api/plans';
import { PrintPage } from './PrintPage';

vi.mock('../../api/plans');
// the mocked plan lacks the profile and blocks PlanView needs, so PlanView
// is replaced with one that renders nothing
vi.mock('./PlanView', () => ({ PlanView: () => null }));

// any title; the tests check PrintPage changes it
const APP_TITLE = 'Prep Period';

beforeEach(() => {
  document.title = APP_TITLE;
});

/**
 * Renders PrintPage with getPlan mocked to return a plan titled `title`, and
 * returns its `onClose` along with RTL's render result.
 */
function renderPrintPage(title: string) {
  vi.mocked(getPlan).mockResolvedValue({ id: 'plan-1', title } as Plan);
  const onClose = vi.fn();
  const result = render(<PrintPage planId="plan-1" onClose={onClose} />);
  return { ...result, onClose };
}

describe('PrintPage', () => {
  it("titles the tab with the plan's title once the plan loads", async () => {
    renderPrintPage('Thursday sub plan');
    await waitFor(() => expect(document.title).toBe('Thursday sub plan'));
  });

  it('puts back the title it replaced when the page closes', async () => {
    const { unmount } = renderPrintPage('Thursday sub plan');
    await waitFor(() => expect(document.title).toBe('Thursday sub plan'));
    unmount();
    expect(document.title).toBe(APP_TITLE);
  });

  it('enables the Print button once the plan loads', async () => {
    renderPrintPage('Thursday sub plan');
    const printButton = screen.getByRole('button', { name: 'Print' });

    expect(printButton).toBeDisabled();
    await waitFor(() => expect(printButton).toBeEnabled());
  });

  it("opens the browser's print dialog when the Print button is clicked", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderPrintPage('Thursday sub plan');
    const printButton = screen.getByRole('button', { name: 'Print' });

    await waitFor(() => expect(printButton).toBeEnabled());
    await user.click(printButton);
    expect(print).toHaveBeenCalledOnce();
  });

  it('shows the load error and keeps the Print button disabled', async () => {
    vi.mocked(getPlan).mockRejectedValue(new Error('Plan not found'));
    render(<PrintPage planId="plan-1" onClose={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Plan not found',
    );
    expect(screen.queryByText('Loading plan...')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print' })).toBeDisabled();
  });

  it('calls onClose when the Back button to plan is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderPrintPage('Thursday sub plan');
    await user.click(screen.getByRole('button', { name: 'Back to plan' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
