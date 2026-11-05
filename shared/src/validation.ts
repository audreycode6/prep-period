import type { Activity, Block } from './index.js';

type TimeSpan = Pick<Block, 'startMinutes' | 'endMinutes'>;

/**
 * Returns the ids of every block whose time range overlaps another block's.
 * A block that starts exactly when another ends does not overlap it.
 */
export function overlappingBlockIds(
  blocks: (TimeSpan & Pick<Block, 'id'>)[],
): Set<string> {
  const ids = new Set<string>();
  blocks.forEach((block, index) => {
    for (const laterBlock of blocks.slice(index + 1)) {
      if (
        block.startMinutes < laterBlock.endMinutes &&
        laterBlock.startMinutes < block.endMinutes
      ) {
        ids.add(block.id);
        ids.add(laterBlock.id);
      }
    }
  });
  return ids;
}

/**
 * Compares the total of a block's activity minutes with the block's length.
 * Activities with null minutes are flexible and count as 0. Returns both
 * totals when the activities run over the block, and null when they fit.
 */
export function activityMinutesOverBlockLength(
  block: TimeSpan & { activities: Pick<Activity, 'minutes'>[] },
): { activityMinutes: number; blockMinutes: number } | null {
  const blockMinutes = block.endMinutes - block.startMinutes;
  const activityMinutes = block.activities.reduce(
    (total, activity) => total + (activity.minutes ?? 0),
    0,
  );
  return activityMinutes > blockMinutes
    ? { activityMinutes, blockMinutes }
    : null;
}
