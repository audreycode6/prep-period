import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { db } from '../db.js';
import { sessionStore } from '../middleware/session.js';
import { activityRows, addBlock, createPlan } from '../test/plans.js';
import { teacherWithProfile, twoTeachers } from '../test/teachers.js';

beforeEach(async () => {
  await db.raw('truncate table teachers, session cascade');
});

afterAll(async () => {
  await sessionStore.close(); // connect-pg-simple's pool
  await db.destroy(); // knex's pool
});

/* Test Ownership:
 Can teacher "other" see or change teacher "owner"'s blocks?
 Blocks reach their owner through their plan, so every lookup joins through
 it. The answer must always be no, and the "no" must not give anything away.
 */
describe('blocks: another teacher', () => {
  it("answers 404 on PUT activities; cannot change another teacher's block", async () => {
    const { owner, other } = await twoTeachers();
    const blockId = await addBlock(
      owner.agent,
      await createPlan(owner.agent),
      480,
      540,
    );
    await owner.agent
      .put(`/api/blocks/${blockId}/activities`)
      .send([{ label: 'Warm-up' }]);

    const before = await activityRows(blockId);
    const res = await other.agent
      .put(`/api/blocks/${blockId}/activities`)
      .send([]);

    expect(res.status).toBe(404);
    expect(await activityRows(blockId)).toEqual(before);
  });

  it("answers 404 on PATCH and DELETE :id; cannot change or delete another teacher's block", async () => {
    const { owner, other } = await twoTeachers();
    const blockId = await addBlock(
      owner.agent,
      await createPlan(owner.agent),
      480,
      540,
    );
    const before = await db('blocks').where({ id: blockId }).first();

    const patchRes = await other.agent
      .patch(`/api/blocks/${blockId}`)
      .send({ title: 'Taken' });
    const deleteRes = await other.agent.delete(`/api/blocks/${blockId}`);

    expect(patchRes.status).toBe(404);
    expect(deleteRes.status).toBe(404);
    expect(await db('blocks').where({ id: blockId }).first()).toEqual(before);
  });
});

/* Test block routes before a session is active:

Calling them with a random uuid and an empty body proves the 401 happens
before any parsing or lookup, so it can only come from requireAuth running
first.
*/
describe('blocks: no session', () => {
  it('answers 401 on every block route without a cookie', async () => {
    const app = createApp();
    const randomId = crypto.randomUUID();

    const responses = [
      await request(app).patch(`/api/blocks/${randomId}`).send({}),
      await request(app).delete(`/api/blocks/${randomId}`),
      await request(app).put(`/api/blocks/${randomId}/activities`).send([]),
    ];

    for (const res of responses) {
      expect(res.status).toBe(401);
    }
  });
});

/**
 * Tests the rules for a teacher's own blocks
 */
describe('blocks: one teacher', () => {
  it('keeps activity ids on PUT activities when the same list is saved twice', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const blockId = await addBlock(
      user.agent,
      await createPlan(user.agent),
      480,
      540,
    );

    const first = await user.agent
      .put(`/api/blocks/${blockId}/activities`)
      .send([{ label: 'Warm-up' }, { label: 'Mini-lesson' }]);
    const second = await user.agent
      .put(`/api/blocks/${blockId}/activities`)
      .send(first.body);

    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
  });

  it('deletes an activity left out of the list, keeps the ids of the rest, and renumbers their positions', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const blockId = await addBlock(
      user.agent,
      await createPlan(user.agent),
      480,
      540,
    );
    const first = await user.agent
      .put(`/api/blocks/${blockId}/activities`)
      .send([
        { label: 'Warm-up' },
        { label: 'Mini-lesson' },
        { label: 'Exit' },
      ]);
    const [warmUp, miniLesson, exit] = first.body;

    // Warm-up dropped, Exit moved to the top
    const res = await user.agent
      .put(`/api/blocks/${blockId}/activities`)
      .send([exit, miniLesson]);

    expect(res.status).toBe(200);
    expect(res.body.map((a: { id: string }) => a.id)).toEqual([
      exit.id,
      miniLesson.id,
    ]);
    const rows = await activityRows(blockId);
    expect(rows.map((row) => [row.id, row.position])).toEqual([
      [exit.id, 0],
      [miniLesson.id, 1],
    ]);
    expect(rows.map((row) => row.id)).not.toContain(warmUp.id);
  });

  it("keeps an activity's annotations when the list is saved again, and deletes them with the activity", async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const blockId = await addBlock(
      user.agent,
      await createPlan(user.agent),
      480,
      540,
    );
    const first = await user.agent
      .put(`/api/blocks/${blockId}/activities`)
      .send([{ label: 'Warm-up' }, { label: 'Mini-lesson' }]);
    const [warmUp, miniLesson] = first.body;
    // set up straight in Postgres, so this test depends only on saving activities
    await db('annotations').insert({
      block_id: blockId,
      activity_id: miniLesson.id,
      type: 'heads_up',
      text: 'Sam leaves at 9:15',
      position: 0,
    });
    const annotationsOn = (activityId: string) =>
      db('annotations').where({ activity_id: activityId });

    await user.agent
      .put(`/api/blocks/${blockId}/activities`)
      .send([warmUp, { ...miniLesson, label: 'Mini-lesson, short' }]);
    expect(await annotationsOn(miniLesson.id)).toHaveLength(1);

    await user.agent.put(`/api/blocks/${blockId}/activities`).send([warmUp]);
    expect(await annotationsOn(miniLesson.id)).toEqual([]);
  });

  it('answers 400 on PUT with the same activity id twice, and changes nothing', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const blockId = await addBlock(
      user.agent,
      await createPlan(user.agent),
      480,
      540,
    );
    const first = await user.agent
      .put(`/api/blocks/${blockId}/activities`)
      .send([{ label: 'Warm-up' }]);

    const before = await activityRows(blockId);
    const res = await user.agent
      .put(`/api/blocks/${blockId}/activities`)
      .send([first.body[0], first.body[0]]);

    expect(res.status).toBe(400);
    expect(await activityRows(blockId)).toEqual(before);
  });

  it("answers 400 on PUT with another block's activity id, and changes nothing", async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const planId = await createPlan(user.agent);
    const morningId = await addBlock(user.agent, planId, 480, 540);
    const afternoonId = await addBlock(user.agent, planId, 780, 840);
    const morningRes = await user.agent
      .put(`/api/blocks/${morningId}/activities`)
      .send([{ label: 'Warm-up' }]);
    await user.agent
      .put(`/api/blocks/${afternoonId}/activities`)
      .send([{ label: 'Read-aloud' }]);

    const before = await activityRows(afternoonId);
    const res = await user.agent
      .put(`/api/blocks/${afternoonId}/activities`)
      .send([{ label: 'New' }, morningRes.body[0]]);

    expect(res.status).toBe(400);
    expect(await activityRows(afternoonId)).toEqual(before);
  });

  it("changes only the fields sent on PATCH :id and updates the plan's updatedAt", async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const planId = await createPlan(user.agent);
    const blockId = await addBlock(user.agent, planId, 480, 540);
    await user.agent
      .put(`/api/blocks/${blockId}/activities`)
      .send([{ label: 'Warm-up' }]);
    const planBefore = await user.agent.get(`/api/plans/${planId}`);

    const res = await user.agent
      .patch(`/api/blocks/${blockId}`)
      .send({ title: 'Reading' }); // only change title property

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: blockId,
      title: 'Reading',
      startMinutes: 480,
      endMinutes: 540,
      activities: [{ label: 'Warm-up' }],
    });
    const planAfter = await user.agent.get(`/api/plans/${planId}`);
    expect(new Date(planAfter.body.updatedAt).getTime()).toBeGreaterThan(
      new Date(planBefore.body.updatedAt).getTime(),
    );
  });

  it('answers 400 with fields on PATCH :id when the new start is after the saved end, and changes nothing', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const blockId = await addBlock(
      user.agent,
      await createPlan(user.agent),
      480,
      540,
    );
    const before = await db('blocks').where({ id: blockId }).first();

    // valid on its own; only the stored endMinutes of 540 makes it negative
    const res = await user.agent
      .patch(`/api/blocks/${blockId}`)
      .send({ startMinutes: 600 });

    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual({
      endMinutes: ['End time must be after start time'],
    });
    expect(await db('blocks').where({ id: blockId }).first()).toEqual(before);
  });

  it("removes the block from its plan on DELETE :id and updates the plan's updatedAt", async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const planId = await createPlan(user.agent);
    const keptId = await addBlock(user.agent, planId, 480, 540);
    const deletedId = await addBlock(user.agent, planId, 600, 660);
    const before = await user.agent.get(`/api/plans/${planId}`);

    const res = await user.agent.delete(`/api/blocks/${deletedId}`);

    expect(res.status).toBe(204);
    const after = await user.agent.get(`/api/plans/${planId}`);
    expect(after.body.blocks.map((b: { id: string }) => b.id)).toEqual([
      keptId,
    ]);
    expect(new Date(after.body.updatedAt).getTime()).toBeGreaterThan(
      new Date(before.body.updatedAt).getTime(),
    );
  });

  it('answers 200 on PATCH :id with an empty body and changes neither the block nor its plan', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const planId = await createPlan(user.agent);
    const blockId = await addBlock(user.agent, planId, 480, 540);
    const before = await user.agent.get(`/api/plans/${planId}`);
    const blockBefore = await db('blocks').where({ id: blockId }).first();

    const res = await user.agent.patch(`/api/blocks/${blockId}`).send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual(before.body.blocks[0]);
    expect(await db('blocks').where({ id: blockId }).first()).toEqual(
      blockBefore,
    );
    const after = await user.agent.get(`/api/plans/${planId}`);
    expect(after.body.updatedAt).toBe(before.body.updatedAt);
  });

  it('returns the block on PATCH :id with its saved annotations, matching the block from GET', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const planId = await createPlan(user.agent);
    const blockId = await addBlock(user.agent, planId, 480, 540);
    // set up straight in Postgres, so this test depends only on PATCH
    await db('annotations').insert({
      block_id: blockId,
      type: 'heads_up',
      text: 'Sam leaves at 9:15',
      position: 0,
    });

    const res = await user.agent
      .patch(`/api/blocks/${blockId}`)
      .send({ title: 'Reading' });

    expect(res.status).toBe(200);
    expect(res.body.annotations).toHaveLength(1);
    const plan = await user.agent.get(`/api/plans/${planId}`);
    expect(res.body).toEqual(plan.body.blocks[0]);
  });

  it('reorders the plan by the new times after PATCH :id', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const planId = await createPlan(user.agent);
    const firstId = await addBlock(user.agent, planId, 480, 540);
    const secondId = await addBlock(user.agent, planId, 600, 660);

    // moves the 8:00 block to 11:00, after the 10:00 one
    const res = await user.agent
      .patch(`/api/blocks/${firstId}`)
      .send({ startMinutes: 660, endMinutes: 720 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ startMinutes: 660, endMinutes: 720 });
    const plan = await user.agent.get(`/api/plans/${planId}`);
    expect(plan.body.blocks.map((b: { id: string }) => b.id)).toEqual([
      secondId,
      firstId,
    ]);
  });
});

/* Test input the schemas or the id check refuse:
 each one is answered with a 400 or 404 before any query runs, never a 500.
 */
describe('blocks: bad input', () => {
  it('answers 404, not 500, on a malformed id for every block route', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');

    const responses = [
      await user.agent.patch('/api/blocks/not-a-uuid').send({ title: 'Math' }),
      await user.agent.delete('/api/blocks/not-a-uuid'),
      await user.agent.put('/api/blocks/not-a-uuid/activities').send([]),
    ];

    for (const res of responses) {
      expect(res.status).toBe(404);
    }
  });

  it('answers 400 on PUT activities naming each bad field by item index and property, and saves nothing', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const blockId = await addBlock(
      user.agent,
      await createPlan(user.agent),
      480,
      540,
    );

    // item 0 is valid; item 1 has a blank label and a non-positive minutes
    const res = await user.agent
      .put(`/api/blocks/${blockId}/activities`)
      .send([{ label: 'Warm-up' }, { label: '', minutes: 0 }]);

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual([
      '1.label',
      '1.minutes',
    ]);
    expect(await activityRows(blockId)).toEqual([]);
  });

  it('answers 400 with fields on PATCH :id with a bad field, and changes nothing', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const blockId = await addBlock(
      user.agent,
      await createPlan(user.agent),
      480,
      540,
    );
    const before = await db('blocks').where({ id: blockId }).first();

    const res = await user.agent
      .patch(`/api/blocks/${blockId}`)
      .send({ endMinutes: 1440 });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields)).toEqual(['endMinutes']);
    expect(await db('blocks').where({ id: blockId }).first()).toEqual(before);
  });
});
