import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  dateToDisplay,
  type Block,
  type ClassroomProfile,
  type Plan,
} from '@prep-period/shared';
import { PlanView } from './PlanView';

const BLOCK: Block = {
  id: 'block-1',
  title: 'Reading',
  description: null,
  startMinutes: 525,
  endMinutes: 585,
  activities: [],
  annotations: [],
};

const PROFILE: ClassroomProfile = {
  id: 'profile-1',
  name: 'Room 12',
  isDefault: true,
  schoolInfo: [{ label: 'Fire drill', note: 'Exit left' }],
  contacts: [
    { name: 'Mr. Okafor', role: 'Teacher next door', reach: 'Room 14' },
    { name: 'Front office', role: 'Secretary', reach: '' },
  ],
  classroomNotes: [{ label: 'Bathroom', note: 'One at a time' }],
  studentNotes: [{ label: 'Leo', note: 'Peanut allergy' }],
  inUse: true,
  isArchived: false,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
};

const PLAN: Plan = {
  id: 'plan-1',
  title: 'Thursday sub plan',
  date: '2026-11-12',
  todayNote: 'Assembly at 1:15',
  isTemplate: false,
  profile: PROFILE,
  blocks: [BLOCK],
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
};

/**
 * The text of every heading on the page, in page order.
 */
function headingTexts() {
  return screen.getAllByRole('heading').map((heading) => heading.textContent);
}

describe('PlanView', () => {
  it('shows the section headings in their fixed order', () => {
    render(<PlanView plan={PLAN} />);
    expect(headingTexts()).toEqual([
      'Thursday sub plan',
      'Today',
      'Classroom profile: Room 12',
      'School info',
      'Contacts',
      'Classroom notes',
      'Student notes',
      'Schedule',
      expect.stringContaining('Reading'),
    ]);
  });

  it("shows the plan's date as a long date", () => {
    render(<PlanView plan={PLAN} />);
    expect(screen.getByText(dateToDisplay('2026-11-12'))).toBeInTheDocument();
  });

  it('leaves out a missing date and today-note, and any empty section', () => {
    render(
      <PlanView
        plan={{
          ...PLAN,
          date: null,
          todayNote: null,
          // school info and classroom notes keep entries, so the profile
          // still shows without its Contacts list
          profile: { ...PROFILE, contacts: [], studentNotes: [] },
          blocks: [],
        }}
      />,
    );
    expect(headingTexts()).toEqual([
      'Thursday sub plan',
      'Classroom profile: Room 12',
      'School info',
      'Classroom notes',
    ]);
    expect(screen.queryByText(/2026/)).not.toBeInTheDocument();
  });

  it('hides the profile section when none of its lists has entries', () => {
    render(
      <PlanView
        plan={{
          ...PLAN,
          // student notes keep their entry: they're a separate section
          profile: {
            ...PROFILE,
            schoolInfo: [],
            contacts: [],
            classroomNotes: [],
          },
        }}
      />,
    );
    expect(headingTexts()).not.toContain('Classroom profile: Room 12');
    expect(headingTexts()).toContain('Student notes');
  });

  it('shows each entry as its label followed by its note', () => {
    render(<PlanView plan={PLAN} />);
    expect(screen.getByText('Fire drill').nextElementSibling).toHaveTextContent(
      'Exit left',
    );
  });

  it("shows a contact as 'role · reach', or just the role with no reach", () => {
    render(<PlanView plan={PLAN} />);
    expect(screen.getByText('Teacher next door · Room 14')).toBeInTheDocument();
    expect(screen.getByText('Secretary')).toBeInTheDocument();
  });
});
