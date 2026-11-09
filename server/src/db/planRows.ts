import type { Knex } from 'knex';
import type {
  Activity,
  ActivityStep,
  Annotation,
  AnnotationType,
  Block,
  ClassroomProfile,
  Plan,
  PlanSummary,
} from '@prep-period/shared';

export type PlanRow = {
  id: string;
  teacher_id: string;
  profile_id: string;
  title: string;
  date: string | null; // 'YYYY-MM-DD', see the DATE parser in ../db.ts
  is_template: boolean;
  today_note: string | null;
  share_token: string | null;
  created_at: Date;
  updated_at: Date;
};

export type BlockRow = {
  id: string;
  plan_id: string;
  profile_id: string | null;
  title: string;
  description: string | null;
  start_minutes: number;
  end_minutes: number;
  created_at: Date;
  updated_at: Date;
};

export type ActivityRow = {
  id: string;
  block_id: string;
  label: string;
  steps: ActivityStep[];
  minutes: number | null;
  position: number;
  created_at: Date;
  updated_at: Date;
};

export type AnnotationRow = {
  id: string;
  block_id: string;
  activity_id: string | null;
  type: AnnotationType;
  text: string;
  position: number;
  created_at: Date;
  updated_at: Date;
};

export type PlanSummaryRow = Pick<
  PlanRow,
  'id' | 'title' | 'date' | 'updated_at'
> & {
  profile_id: string;
  profile_name: string;
  profile_archived_at: Date | null;
};

export function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    label: row.label,
    steps: row.steps,
    minutes: row.minutes,
  };
}

export function toAnnotation(row: AnnotationRow): Annotation {
  return {
    id: row.id,
    activityId: row.activity_id,
    type: row.type,
    text: row.text,
  };
}

export function toBlock(
  row: BlockRow,
  activities: Activity[],
  annotations: Annotation[],
): Block {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startMinutes: row.start_minutes,
    endMinutes: row.end_minutes,
    activities,
    annotations,
  };
}

/**
 * Maps each row with `toItem` and groups the items by the row's block_id,
 * keeping row order. Blocks with no rows have no entry in the Map.
 */
function groupByBlock<Row extends { block_id: string }, Item>(
  rows: Row[],
  toItem: (row: Row) => Item,
): Map<string, Item[]> {
  const byBlock = new Map<string, Item[]>();
  for (const row of rows) {
    const items = byBlock.get(row.block_id) ?? [];
    items.push(toItem(row));
    byBlock.set(row.block_id, items);
  }
  return byBlock;
}

/**
 * Reads the activities and annotations of the given blocks, each by position
 * and grouped by block id. Takes db or a transaction, so a
 * caller inside a transaction reads its own writes.
 */
export async function readBlockContents(conn: Knex, blockIds: string[]) {
  const activityRows: ActivityRow[] = await conn('activities')
    .whereIn('block_id', blockIds)
    .orderBy('position');
  const annotationRows: AnnotationRow[] = await conn('annotations')
    .whereIn('block_id', blockIds)
    .orderBy('position');
  return {
    activities: groupByBlock(activityRows, toActivity),
    annotations: groupByBlock(annotationRows, toAnnotation),
  };
}

export function toPlan(
  row: PlanRow,
  profile: ClassroomProfile,
  blocks: Block[],
): Plan {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    todayNote: row.today_note,
    profile,
    blocks,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function toSummary(row: PlanSummaryRow): PlanSummary {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    updatedAt: row.updated_at.toISOString(),
    profile: {
      id: row.profile_id,
      name: row.profile_name,
      isArchived: row.profile_archived_at !== null,
    },
  };
}
