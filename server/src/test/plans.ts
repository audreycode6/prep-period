import { db } from '../db.js';
import type { Agent } from './teachers.js';

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
