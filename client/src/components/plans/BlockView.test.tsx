import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Block } from '@prep-period/shared';
import { BlockView } from './BlockView';

const BLOCK: Block = {
  id: 'block-1',
  title: 'Reading',
  description: null,
  startMinutes: 525,
  endMinutes: 585,
  activities: [
    { id: 'activity-1', label: 'Read-aloud', steps: [], minutes: 20 },
    {
      id: 'activity-2',
      label: 'Independent reading',
      steps: [{ text: 'Pick a book' }],
      minutes: null,
    },
  ],
  annotations: [
    {
      id: 'annotation-1',
      activityId: 'activity-2',
      type: 'good_to_know',
      text: 'Book bins are by the window',
    },
    {
      id: 'annotation-2',
      activityId: null,
      type: 'must_know',
      text: 'Groups are paused this week',
    },
  ],
};

describe('BlockView', () => {
  it("shows each activity's minutes, or flexible when it has none", () => {
    render(<BlockView block={BLOCK} />);
    const [readAloud, independentReading] = screen.getAllByRole('listitem');
    expect(readAloud).toHaveTextContent('Read-aloud · 20 min');
    expect(independentReading).toHaveTextContent(
      'Independent reading · flexible',
    );
  });

  it("shows an activity's steps under it", () => {
    render(<BlockView block={BLOCK} />);
    const [, independentReading] = screen.getAllByRole('listitem');
    expect(within(independentReading).getByText('Pick a book')).toBeVisible();
  });

  it('puts whole-block annotations right above the activities', () => {
    render(<BlockView block={BLOCK} />);
    const blockAnnotation = screen.getByText('Groups are paused this week');
    const [activityList] = screen.getAllByRole('list');

    expect(blockAnnotation).toHaveTextContent(
      'Must know: Groups are paused this week',
    );
    expect(blockAnnotation.nextElementSibling).toBe(activityList);
  });

  it("puts an activity's annotations under that activity", () => {
    render(<BlockView block={BLOCK} />);
    const [readAloud, independentReading] = screen.getAllByRole('listitem');

    expect(readAloud).not.toHaveTextContent('Book bins');
    expect(independentReading).toHaveTextContent(
      'Good to know: Book bins are by the window',
    );
  });
});
