import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { db } from '../db.js';
import { sessionStore } from '../middleware/session.js';
import {
  teacherWithProfile,
  twoTeachers,
  type Agent,
} from '../test/teachers.js';

beforeEach(async () => {
  await db.raw('truncate table teachers, session cascade');
});

afterAll(async () => {
  await sessionStore.close(); // connect-pg-simple's pool
  await db.destroy(); // knex's pool
});

/** Creates a plan through the route and returns its id. */
async function createPlan(agent: Agent): Promise<string> {
  const res = await agent.post('/api/plans').send({ title: 'Monday' });
  return res.body.id;
}

/** Adds a block through the route and returns its id. */
async function addBlock(
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
async function activityRows(blockId: string) {
  return db('activities').where({ block_id: blockId }).orderBy('position');
}

/* Test Ownership:
 Can teacher "other" see or change teacher "owner"'s plans?
 Plans reach their owner through teacher_id, and blocks through their plan,
 so both paths are checked. The answer must always be no, and the "no" must
 not give anything away.
 */
describe('plans: another teacher', () => {
  it("answers 404 on GET :id; cannot read another teacher's plan", async () => {
    const { owner, other } = await twoTeachers();
    const planId = await createPlan(owner.agent);

    const res = await other.agent.get(`/api/plans/${planId}`);
    const missing = await other.agent.get(`/api/plans/${crypto.randomUUID()}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(missing.body);
  });

  it("answers 404 on POST blocks; cannot add a block to another teacher's plan", async () => {
    const { owner, other } = await twoTeachers();
    const planId = await createPlan(owner.agent);

    const res = await other.agent
      .post(`/api/plans/${planId}/blocks`)
      .send({ title: 'Math', startMinutes: 480, endMinutes: 540 });

    expect(res.status).toBe(404);
    expect(await db('blocks').where({ plan_id: planId })).toEqual([]);
  });

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

  it("answers 400 on POST with another teacher's profileId, and creates nothing", async () => {
    const { owner, other } = await twoTeachers();

    const res = await other.agent
      .post('/api/plans')
      .send({ title: 'Monday', profileId: owner.profileId });

    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual({ profileId: ['Profile not found'] });
    expect(await db('plans')).toEqual([]);
  });
});

/* Test plan routes before a session is active:

Calling them with a random uuid and an empty body proves the 401 happens
before any parsing or lookup, so it can only come from requireAuth running
first.
*/
describe('plans: no session', () => {
  it('answers 401 on every plan and block route without a cookie', async () => {
    const app = createApp();
    const randomId = crypto.randomUUID();

    const responses = [
      await request(app).post('/api/plans').send({}),
      await request(app).get(`/api/plans/${randomId}`),
      await request(app).post(`/api/plans/${randomId}/blocks`).send({}),
      await request(app).put(`/api/blocks/${randomId}/activities`).send([]),
    ];

    for (const res of responses) {
      expect(res.status).toBe(401);
    }
  });
});

/**
 * Tests the rules for a teacher's own plans
 */
describe('plans: one teacher', () => {
  it('creates a plan on the default profile when no profileId is sent', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    await user.agent.post('/api/profiles').send({ name: 'Not the default' });

    const res = await user.agent.post('/api/plans').send({ title: 'Monday' });

    expect(res.status).toBe(201);
    expect(res.body.profile.id).toBe(user.profileId);
    expect(res.body.blocks).toEqual([]);
  });

  it('creates a plan on a non-default profile when its profileId is sent', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const secondRes = await user.agent
      .post('/api/profiles')
      .send({ name: 'Pull-out group' });

    const res = await user.agent
      .post('/api/plans')
      .send({ title: 'Monday', profileId: secondRes.body.id });

    expect(res.status).toBe(201);
    expect(res.body.profile).toMatchObject({
      id: secondRes.body.id,
      name: 'Pull-out group',
    });
  });

  it('reads a block with no activities back with an empty activities list', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const planId = await createPlan(user.agent);
    const blockId = await addBlock(user.agent, planId, 480, 540);

    const res = await user.agent.get(`/api/plans/${planId}`);

    expect(res.status).toBe(200);
    expect(res.body.blocks).toEqual([
      expect.objectContaining({ id: blockId, activities: [] }),
    ]);
  });

  it('answers 409 on POST with an archived profileId, and creates nothing', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const archivedRes = await user.agent
      .post('/api/profiles')
      .send({ name: 'Last year' });
    await user.agent.post(`/api/profiles/${archivedRes.body.id}/archive`);

    const res = await user.agent
      .post('/api/plans')
      .send({ title: 'Monday', profileId: archivedRes.body.id });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'profile is archived' });
    expect(await db('plans')).toEqual([]);
  });

  it('answers 409 on POST when the teacher has no live profile', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    await user.agent.post(`/api/profiles/${user.profileId}/archive`);

    const res = await user.agent.post('/api/plans').send({ title: 'Monday' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'create a profile first' });
  });

  it('answers 400 with fields.endMinutes on a block that ends at or before its start, and adds nothing', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const planId = await createPlan(user.agent);

    for (const endMinutes of [540, 480]) {
      const res = await user.agent
        .post(`/api/plans/${planId}/blocks`)
        .send({ title: 'Math', startMinutes: 540, endMinutes });

      expect(res.status).toBe(400);
      expect(res.body.fields).toEqual({
        endMinutes: ['End time must be after start time'],
      });
    }
    expect(await db('blocks').where({ plan_id: planId })).toEqual([]);
  });

  it('creates a plan sent without a date, and reads it back with date: null and the other fields as sent', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const created = await user.agent
      .post('/api/plans')
      .send({ title: 'Generic Monday', todayNote: 'Fire drill at 10' });

    const res = await user.agent.get(`/api/plans/${created.body.id}`);

    expect(res.status).toBe(200);
    expect(res.body.date).toBeNull();
    expect(res.body).toMatchObject({
      title: 'Generic Monday',
      date: null,
      todayNote: 'Fire drill at 10',
    });
  });

  it('still reads a plan whose profile was archived after it was made, with isArchived: true', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const planId = await createPlan(user.agent);
    await user.agent.post(`/api/profiles/${user.profileId}/archive`);

    const res = await user.agent.get(`/api/plans/${planId}`);

    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({
      id: user.profileId,
      isArchived: true,
    });
  });

  it("reads a plan back with its blocks in clock order and each block's activities in position order", async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const planRes = await user.agent
      .post('/api/plans')
      .send({ title: 'Monday', date: '2026-11-02' });
    const planId = planRes.body.id;

    // added afternoon first, so the read has to sort them
    const afternoonId = await addBlock(user.agent, planId, 780, 840);
    const morningId = await addBlock(user.agent, planId, 480, 540);
    await user.agent
      .put(`/api/blocks/${morningId}/activities`)
      .send([
        { label: 'Warm-up', steps: [{ text: 'Stretch' }], minutes: 5 },
        { label: 'Mini-lesson' },
      ]);
    await user.agent
      .put(`/api/blocks/${afternoonId}/activities`)
      .send([{ label: 'Read-aloud' }]);

    const res = await user.agent.get(`/api/plans/${planId}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: planId,
      title: 'Monday',
      date: '2026-11-02',
      profile: { id: user.profileId },
      blocks: [
        {
          id: morningId,
          activities: [
            { label: 'Warm-up', steps: [{ text: 'Stretch' }], minutes: 5 },
            { label: 'Mini-lesson', steps: [], minutes: null },
          ],
        },
        { id: afternoonId, activities: [{ label: 'Read-aloud' }] },
      ],
    });
  });

  it('keeps activity ids when the same list is saved twice', async () => {
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
    // straight into Postgres: annotations route not built yet
    await db('annotations').insert({
      block_id: blockId,
      activity_id: miniLesson.id,
      type: 'heads_up',
      text: 'Sam leaves at 9:15',
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
});

/* Test input the schemas or the id check refuse:
 each one is answered with a 400 or 404 before any query runs, never a 500.
 */
describe('plans: bad input', () => {
  it('answers 404, not 500, on a malformed id for every plan and block route', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');

    const responses = [
      await user.agent.get('/api/plans/not-a-uuid'),
      await user.agent
        .post('/api/plans/not-a-uuid/blocks')
        .send({ title: 'Math', startMinutes: 480, endMinutes: 540 }),
      await user.agent.put('/api/blocks/not-a-uuid/activities').send([]),
    ];

    for (const res of responses) {
      expect(res.status).toBe(404);
    }
  });

  it('answers 400 with fields on a blank title or a date not written YYYY-MM-DD', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');

    const res = await user.agent
      .post('/api/plans')
      .send({ title: '  ', date: '11/02/2026' });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual(['date', 'title']);
    expect(await db('plans')).toEqual([]);
  });

  it('answers 400 with fields on block times outside the day or not whole minutes', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const planId = await createPlan(user.agent);

    const cases = [
      { startMinutes: -1, endMinutes: 60, field: 'startMinutes' },
      { startMinutes: 60, endMinutes: 1440, field: 'endMinutes' },
      { startMinutes: 90.5, endMinutes: 120, field: 'startMinutes' },
    ];
    for (const { field, ...times } of cases) {
      const res = await user.agent
        .post(`/api/plans/${planId}/blocks`)
        .send({ title: 'Math', ...times });

      expect(res.status).toBe(400);
      expect(Object.keys(res.body.fields)).toEqual([field]);
    }
    expect(await db('blocks').where({ plan_id: planId })).toEqual([]);
  });

  it('answers 400 naming each bad field by item index and property', async () => {
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
});
