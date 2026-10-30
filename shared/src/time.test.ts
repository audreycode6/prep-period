import { describe, expect, it } from 'vitest';
import { minutesToTimeInput, timeInputToMinutes } from './time.js';

describe('timeInputToMinutes', () => {
  it('converts a time input value to minutes since midnight', () => {
    expect(timeInputToMinutes('08:00')).toBe(480);
    expect(timeInputToMinutes('14:30')).toBe(870);
    expect(timeInputToMinutes('00:00')).toBe(0);
    expect(timeInputToMinutes('23:59')).toBe(1439);
    expect(timeInputToMinutes('19:59')).toBe(1199);
    expect(timeInputToMinutes('20:00')).toBe(1200);
  });

  it('returns null for an empty value', () => {
    expect(timeInputToMinutes('')).toBeNull();
  });

  it('returns null for a value that is not a zero-padded HH:MM from 00:00 to 23:59', () => {
    expect(timeInputToMinutes('junk')).toBeNull();
    expect(timeInputToMinutes('8:00')).toBeNull();
    expect(timeInputToMinutes('24:00')).toBeNull();
    expect(timeInputToMinutes('12:60')).toBeNull();
    expect(timeInputToMinutes('08:00:00')).toBeNull();
  });
});

describe('minutesToTimeInput', () => {
  it('converts minutes since midnight to a padded HH:MM value', () => {
    expect(minutesToTimeInput(480)).toBe('08:00');
    expect(minutesToTimeInput(0)).toBe('00:00');
    expect(minutesToTimeInput(545)).toBe('09:05');
  });

  it('gives back the original minutes when its output is passed to timeInputToMinutes', () => {
    for (const minutes of [0, 480, 870, 1439]) {
      expect(timeInputToMinutes(minutesToTimeInput(minutes))).toBe(minutes);
    }
  });
});
