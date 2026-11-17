import type { Block, Plan } from '@prep-period/shared';
import { db } from '../db.js';
import type { Agent } from './teachers.js';

/**
 * Returns the blocks' content, naming each annotation's activity by its index
 * in the block, or null for the whole block.
 */
export function blockContents(blocks: Block[]) {
  return blocks.map((block) => ({
    title: block.title,
    description: block.description,
    startMinutes: block.startMinutes,
    endMinutes: block.endMinutes,
    activities: block.activities.map((activity) => ({
      label: activity.label,
      steps: activity.steps,
      minutes: activity.minutes,
    })),
    annotations: block.annotations.map((annotation) => ({
      type: annotation.type,
      text: annotation.text,
      activityIndex:
        annotation.activityId === null
          ? null
          : block.activities.findIndex(
              (activity) => activity.id === annotation.activityId,
            ),
    })),
  }));
}

/**
 * Returns the ids of the plan and of its blocks, activities and annotations.
 */
export function planIds(plan: Plan): string[] {
  return [
    plan.id,
    ...plan.blocks.flatMap((block) => [
      block.id,
      ...block.activities.map((activity) => activity.id),
      ...block.annotations.map((annotation) => annotation.id),
    ]),
  ];
}

/** Creates a plan through the route and returns its id. */
export async function createPlan(agent: Agent): Promise<string> {
  const res = await agent.post('/api/plans').send({ title: 'Monday' });
  return res.body.id;
}

/** Adds a block through the route and returns its id. */
export async function addBlock(
  agent: Agent,
  planId: string,
  startMinutes: number,
  endMinutes: number,
): Promise<string> {
  const res = await agent
    .post(`/api/plans/${planId}/blocks`)
    .send({ title: 'Math', startMinutes, endMinutes });
  return res.body.id;
}

/** Reads the block's activity rows straight from Postgres, in order. */
export async function activityRows(blockId: string) {
  return db('activities').where({ block_id: blockId }).orderBy('position');
}

/** Reads the block's annotation rows straight from Postgres, in order. */
export async function annotationRows(blockId: string) {
  return db('annotations').where({ block_id: blockId }).orderBy('position');
}
