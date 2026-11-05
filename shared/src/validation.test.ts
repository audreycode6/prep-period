import { describe, expect, it } from 'vitest';
import {
  activityMinutesOverBlockLength,
  overlappingBlockIds,
} from './validation.js';

describe('overlappingBlockIds', () => {
  it('treats blocks that only touch as not overlapping', () => {
    const blocks = [
      { id: 'a', startMinutes: 540, endMinutes: 600 },
      { id: 'b', startMinutes: 600, endMinutes: 660 },
    ];
    expect(overlappingBlockIds(blocks)).toEqual(new Set());
  });

  it('flags both blocks when one sits inside the other', () => {
    const blocks = [
      { id: 'outer', startMinutes: 540, endMinutes: 720 },
      { id: 'inner', startMinutes: 600, endMinutes: 630 },
    ];
    expect(overlappingBlockIds(blocks)).toEqual(new Set(['outer', 'inner']));
  });

  it('flags only the blocks that overlap, whatever order they come in', () => {
    // first and last overlap; the middle one sits in a gap of its own
    const blocks = [
      { id: 'first', startMinutes: 540, endMinutes: 610 },
      { id: 'middle', startMinutes: 700, endMinutes: 760 },
      { id: 'last', startMinutes: 600, endMinutes: 650 },
    ];
    expect(overlappingBlockIds(blocks)).toEqual(new Set(['first', 'last']));
  });

  it('returns an empty set for no blocks', () => {
    expect(overlappingBlockIds([])).toEqual(new Set());
  });
});

describe('activityMinutesOverBlockLength', () => {
  // 9:00 to 9:45, a 45-minute block
  const times = { startMinutes: 540, endMinutes: 585 };

  it('returns both totals when the activities run over the block', () => {
    const block = { ...times, activities: [{ minutes: 30 }, { minutes: 20 }] };
    expect(activityMinutesOverBlockLength(block)).toEqual({
      activityMinutes: 50,
      blockMinutes: 45,
    });
  });

  it('returns null when the activities exactly fill the block', () => {
    const block = { ...times, activities: [{ minutes: 30 }, { minutes: 15 }] };
    expect(activityMinutesOverBlockLength(block)).toBeNull();
  });

  it('leaves flexible activities out of the total', () => {
    const block = {
      ...times,
      activities: [{ minutes: null }, { minutes: 45 }],
    };
    expect(activityMinutesOverBlockLength(block)).toBeNull();
  });

  it('returns null when every activity is flexible', () => {
    const block = {
      ...times,
      activities: [{ minutes: null }, { minutes: null }],
    };
    expect(activityMinutesOverBlockLength(block)).toBeNull();
  });

  it('returns null for a block with no activities', () => {
    const block = { ...times, activities: [] };
    expect(activityMinutesOverBlockLength(block)).toBeNull();
  });
});
