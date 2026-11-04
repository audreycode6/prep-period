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
 Can teacher "other" see or change teacher "owner"'s plans?
 Plans reach their owner through teacher_id. The answer must always be no,
 and the "no" must not give anything away.
 */
describe('plans: another teacher', () => {
  it("lists only the teacher's own plans on GET /", async () => {
    const { owner, other } = await twoTeachers();
    const planId = await createPlan(owner.agent);
    await createPlan(other.agent);

    const res = await owner.agent.get('/api/plans');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: planId,
        title: 'Monday',
        date: null,
        updatedAt: expect.any(String),
        profile: {
          id: owner.profileId,
          name: "owner@example.com's classroom",
          isArchived: false,
        },
      },
    ]);
  });

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

  it("answers 400 on POST with another teacher's profileId, and creates nothing", async () => {
    const { owner, other } = await twoTeachers();

    const res = await other.agent
      .post('/api/plans')
      .send({ title: 'Monday', profileId: owner.profileId });

    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual({ profileId: ['Profile not found'] });
    expect(await db('plans')).toEqual([]);
  });

  it("answers 404 on PATCH and DELETE :id; cannot change or delete another teacher's plan", async () => {
    const { owner, other } = await twoTeachers();
    const planId = await createPlan(owner.agent);
    const before = await db('plans').where({ id: planId }).first();

    const patchRes = await other.agent
      .patch(`/api/plans/${planId}`)
      .send({ title: 'Taken' });
    const deleteRes = await other.agent.delete(`/api/plans/${planId}`);

    expect(patchRes.status).toBe(404);
    expect(deleteRes.status).toBe(404);
    expect(await db('plans').where({ id: planId }).first()).toEqual(before);
  });

  it("answers 400 on PATCH :id with another teacher's profileId, and changes nothing", async () => {
    const { owner, other } = await twoTeachers();
    const planId = await createPlan(owner.agent);

    const res = await owner.agent
      .patch(`/api/plans/${planId}`)
      .send({ profileId: other.profileId });

    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual({ profileId: ['Profile not found'] });
    const row = await db('plans').where({ id: planId }).first();
    expect(row.profile_id).toBe(owner.profileId);
  });
});

/* Test plan routes before a session is active:

Calling them with a random uuid and an empty body proves the 401 happens
before any parsing or lookup, so it can only come from requireAuth running
first.
*/
describe('plans: no session', () => {
  it('answers 401 on every plan route without a cookie', async () => {
    const app = createApp();
    const randomId = crypto.randomUUID();

    const responses = [
      await request(app).get('/api/plans'),
      await request(app).post('/api/plans').send({}),
      await request(app).get(`/api/plans/${randomId}`),
      await request(app).patch(`/api/plans/${randomId}`).send({}),
      await request(app).delete(`/api/plans/${randomId}`),
      await request(app).post(`/api/plans/${randomId}/blocks`).send({}),
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

  it('reads a block with no activities or annotations back with activities: [] and annotations: []', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const planId = await createPlan(user.agent);
    const blockId = await addBlock(user.agent, planId, 480, 540);

    const res = await user.agent.get(`/api/plans/${planId}`);

    expect(res.status).toBe(200);
    expect(res.body.blocks).toEqual([
      expect.objectContaining({ id: blockId, activities: [], annotations: [] }),
    ]);
  });

  it("reads a block's annotations back in position order, with activityId", async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const planId = await createPlan(user.agent);
    const blockId = await addBlock(user.agent, planId, 480, 540);
    const saved = await user.agent
      .put(`/api/blocks/${blockId}/activities`)
      .send([{ label: 'Mini-lesson' }]);
    const activityId = saved.body[0].id;
    // set up straight in Postgres, so this test depends only on reading
    // inserted second-position first, so the order read back can only come
    // from position
    await db('annotations').insert({
      block_id: blockId,
      activity_id: activityId,
      type: 'heads_up',
      text: 'Sam leaves at 9:15',
      position: 1,
    });
    await db('annotations').insert({
      block_id: blockId,
      type: 'must_know',
      text: 'Fire drill at 9:30',
      position: 0,
    });

    const res = await user.agent.get(`/api/plans/${planId}`);

    expect(res.body.blocks[0].annotations).toEqual([
      {
        id: expect.any(String),
        activityId: null,
        type: 'must_know',
        text: 'Fire drill at 9:30',
      },
      {
        id: expect.any(String),
        activityId,
        type: 'heads_up',
        text: 'Sam leaves at 9:15',
      },
    ]);
  });

  it('reads each block of a plan back with only its own annotations, [] for a block with none', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const planId = await createPlan(user.agent);
    const mathId = await addBlock(user.agent, planId, 480, 540);
    const artId = await addBlock(user.agent, planId, 600, 660);
    const gymId = await addBlock(user.agent, planId, 720, 780);
    // set up straight in Postgres, so this test depends only on reading
    await db('annotations').insert([
      { block_id: artId, type: 'if_time', text: 'Clay if dry', position: 0 },
      { block_id: mathId, type: 'must_know', text: 'Quiz today', position: 0 },
    ]);

    const res = await user.agent.get(`/api/plans/${planId}`);

    const textsByBlockId = Object.fromEntries(
      res.body.blocks.map(
        (block: { id: string; annotations: { text: string }[] }) => [
          block.id,
          block.annotations.map((annotation) => annotation.text),
        ],
      ),
    );
    expect(textsByBlockId).toEqual({
      [mathId]: ['Quiz today'],
      [artId]: ['Clay if dry'],
      [gymId]: [],
    });
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

  it('changes only the fields sent on PATCH :id, leaving the rest of the plan unchanged', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const created = await user.agent.post('/api/plans').send({
      title: 'Monday',
      date: '2026-11-02',
      todayNote: 'Fire drill at 10',
    });

    const res = await user.agent
      .patch(`/api/plans/${created.body.id}`)
      .send({ title: 'Tuesday' }); // only title changed

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: 'Tuesday',
      date: '2026-11-02',
      todayNote: 'Fire drill at 10',
      profile: { id: user.profileId },
    });
  });

  it('answers 409 on PATCH :id moving a plan to a different, archived profile, and changes nothing', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const planId = await createPlan(user.agent);
    const archivedRes = await user.agent
      .post('/api/profiles')
      .send({ name: 'Last year' });
    await user.agent.post(`/api/profiles/${archivedRes.body.id}/archive`);

    const res = await user.agent
      .patch(`/api/plans/${planId}`)
      .send({ profileId: archivedRes.body.id });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'profile is archived' });
    const row = await db('plans').where({ id: planId }).first();
    expect(row.profile_id).toBe(user.profileId);
  });

  it('answers 200 on PATCH :id to a plan whose own profile is archived, sending that profileId back', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const planId = await createPlan(user.agent);
    await user.agent.post(`/api/profiles/${user.profileId}/archive`);

    const res = await user.agent
      .patch(`/api/plans/${planId}`)
      .send({ title: 'Tuesday', profileId: user.profileId });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: 'Tuesday',
      profile: { id: user.profileId, isArchived: true },
    });
  });

  it('deletes a plan with its blocks, activities and annotations on DELETE :id', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const planId = await createPlan(user.agent);
    const blockId = await addBlock(user.agent, planId, 480, 540);
    await user.agent
      .put(`/api/blocks/${blockId}/activities`)
      .send([{ label: 'Warm-up' }]);
    // set up straight in Postgres, so this test depends only on the delete
    await db('annotations').insert({
      block_id: blockId,
      type: 'heads_up',
      text: 'Sam leaves at 9:15',
      position: 0,
    });

    const res = await user.agent.delete(`/api/plans/${planId}`);

    expect(res.status).toBe(204);
    expect((await user.agent.get(`/api/plans/${planId}`)).status).toBe(404);
    expect(await db('blocks').where({ plan_id: planId })).toEqual([]);
    expect(await activityRows(blockId)).toEqual([]);
    expect(await db('annotations').where({ block_id: blockId })).toEqual([]);
  });

  it('moves the plan to another live profile on PATCH :id', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const planId = await createPlan(user.agent);
    const secondRes = await user.agent
      .post('/api/profiles')
      .send({ name: 'Pull-out group' });

    const res = await user.agent
      .patch(`/api/plans/${planId}`)
      .send({ profileId: secondRes.body.id });

    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({
      id: secondRes.body.id,
      name: 'Pull-out group',
    });
    const row = await db('plans').where({ id: planId }).first();
    expect(row.profile_id).toBe(secondRes.body.id);
  });

  it('sets fields to null on PATCH :id when they are sent as null', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const created = await user.agent.post('/api/plans').send({
      title: 'Monday',
      date: '2026-11-02',
      todayNote: 'Fire drill at 10',
    });

    const res = await user.agent
      .patch(`/api/plans/${created.body.id}`)
      .send({ date: null, todayNote: null });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: 'Monday',
      date: null,
      todayNote: null,
    });
  });

  it('answers 200 on PATCH :id with an empty body and changes nothing', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const planId = await createPlan(user.agent);
    const before = await user.agent.get(`/api/plans/${planId}`);

    const res = await user.agent.patch(`/api/plans/${planId}`).send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual(before.body);
  });
});

/* Test input the schemas or the id check refuse:
 each one is answered with a 400 or 404 before any query runs, never a 500.
 */
describe('plans: bad input', () => {
  it('answers 404, not 500, on a malformed id for every plan route', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');

    const responses = [
      await user.agent.get('/api/plans/not-a-uuid'),
      await user.agent.patch('/api/plans/not-a-uuid').send({ title: 'Tue' }),
      await user.agent.delete('/api/plans/not-a-uuid'),
      await user.agent
        .post('/api/plans/not-a-uuid/blocks')
        .send({ title: 'Math', startMinutes: 480, endMinutes: 540 }),
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

  it('answers 400 with fields on PATCH :id with a bad field, and changes nothing', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const planId = await createPlan(user.agent);
    const before = await db('plans').where({ id: planId }).first();

    const res = await user.agent
      .patch(`/api/plans/${planId}`)
      .send({ title: '  ' });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields)).toEqual(['title']);
    expect(await db('plans').where({ id: planId }).first()).toEqual(before);
  });
});
