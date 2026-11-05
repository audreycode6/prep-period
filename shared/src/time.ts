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

/**
 * Formats minutes since midnight as a clock time in the locale's style
 * ("1:17 PM" in en-US, "13:17" in en-GB), the user's own when none is given.
 * Uses UTC so a daylight-saving change can't shift the hour.
 */
export function minutesToDisplay(minutes: number, locale?: string): string {
  const time = new Date(Date.UTC(1970, 0, 1, 0, minutes));
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(time);
}

/**
 * Formats a duration given in minutes as hours and minutes, showing only the
 * parts that apply: minutes alone under an hour, hours alone on the hour,
 * and both otherwise. Expects a whole number of minutes, 0 or more.
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}
