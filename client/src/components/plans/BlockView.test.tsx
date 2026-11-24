import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  annotationTypeSchema,
  type Annotation,
  type AnnotationType,
  type Block,
} from '@prep-period/shared';
import { BlockView } from './BlockView';

/**
 * One whole-block annotation per type, in the order given, each with the text
 * "A <type> note".
 */
function wholeBlockAnnotations(types: readonly AnnotationType[]): Annotation[] {
  return types.map((type) => ({
    id: type,
    activityId: null,
    type,
    text: `A ${type} note`,
  }));
}

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
  it("shows the block's description when it has one", () => {
    render(<BlockView block={{ ...BLOCK, description: 'On the carpet' }} />);
    expect(screen.getByText('On the carpet')).toBeVisible();
  });

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

  it('marks each annotation with its type', () => {
    const annotations = wholeBlockAnnotations(annotationTypeSchema.options);
    render(<BlockView block={{ ...BLOCK, annotations }} />);

    for (const type of annotationTypeSchema.options) {
      expect(screen.getByText(`A ${type} note`)).toHaveAttribute(
        'data-annotation-type',
        type,
      );
    }
  });

  it('shows annotations from most to least urgent', () => {
    const annotations = wholeBlockAnnotations([
      'if_time',
      'heads_up',
      'good_to_know',
      'must_know',
    ]);
    render(<BlockView block={{ ...BLOCK, annotations }} />);
    const shownTypes = screen
      .getAllByText(/ note$/)
      .map((annotation) => annotation.getAttribute('data-annotation-type'));

    expect(shownTypes).toEqual([
      'must_know',
      'heads_up',
      'good_to_know',
      'if_time',
    ]);
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
