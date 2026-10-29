/**
 * Matches the whole string as "HH:MM" in 24-hour time and captures each part:
 * - hours: 00–23 (0 or 1 then any digit, or 2 then 0–3)
 * - minutes: 00–59 (0–5 then any digit)
 */
const TIME_INPUT = /^(?<hours>[01]\d|2[0-3]):(?<minutes>[0-5]\d)$/;

export const MINUTES_PER_DAY = 24 * 60;

/**
 * Converts an `<input type="time">` value ("HH:MM", 24-hour) to minutes since
 * midnight. Returns null for an empty or malformed value, since an empty or
 * half-filled time input gives "" rather than "00:00".
 */
export function timeInputToMinutes(value: string): number | null {
  const groups = TIME_INPUT.exec(value)?.groups;
  if (!groups) return null;
  return Number(groups.hours) * 60 + Number(groups.minutes);
}

/**
 * Converts minutes since midnight to the zero-padded "HH:MM" value an
 * `<input type="time">` expects. Expects a whole number of minutes within one
 * day, the range a block's times are stored in.
 */
export function minutesToTimeInput(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mins = String(minutes % 60).padStart(2, '0');
  return `${hours}:${mins}`;
}
