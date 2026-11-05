/**
 * Returns a count with the right form of the word, e.g. "1 step", "3 steps".
 */
export function pluralize(
  count: number,
  singular: string,
  plural: string,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Joins items into a phrase the way a sentence lists them: "a", "a and b",
 * "a, b and c". Returns '' for no items.
 */
export function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
