import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { db } from '../db.js';
import { sessionStore } from '../middleware/session.js';

beforeEach(async () => {
  await db.raw('truncate table teachers, session cascade');
});

afterAll(async () => {
  await sessionStore.close(); // connect-pg-simple's pool
  await db.destroy(); // knex's pool
});

type Agent = ReturnType<typeof request.agent>;

/**
 * Signs a teacher up through the real route and creates one profile.
 * Returns what the tests need: the logged-in agent, the teacher's id
 * , and the profile's id.
 */
async function teacherWithProfile(
  app: ReturnType<typeof createApp>,
  email: string,
): Promise<{ agent: Agent; teacherId: string; profileId: string }> {
  const agent = request.agent(app);

  const signupRes = await agent.post('/api/auth/signup').send({
    email,
    password: 'supercoolpw',
  });
  const profileRes = await agent
    .post('/api/profiles')
    .send({ name: `${email}'s classroom` });

  return {
    agent,
    teacherId: signupRes.body.id,
    profileId: profileRes.body.id,
  };
}

async function twoTeachers() {
  const app = createApp();
  const owner = await teacherWithProfile(app, 'owner@example.com');
  const other = await teacherWithProfile(app, 'other@example.com');
  return {
    app,
    owner,
    other,
  };
}

/** Reads the row straight from Postgres; catches broken PATCH */
async function profileRow(id: string) {
  return db('classroom_profiles').where({ id }).first();
}

/* Test Ownership:
 Can teacher "other" see or change teacher "owner"'s profile? 
 The answer must always be no, and the "no" must not give anything away.
 */
describe('profiles: another teacher', () => {
  it('answers 404 on GET :id; cannot read another users profile', async () => {
    const { owner, other } = await twoTeachers();

    const res = await other.agent.get(`/api/profiles/${owner.profileId}`);
    const missing = await other.agent.get(
      `/api/profiles/${crypto.randomUUID()}`,
    );
    expect(res.status).toBe(404);
    expect(res.body).toEqual(missing.body);
  });

  it("answers 404 on PATCH name; cannot rename another teacher's profile", async () => {
    const { owner, other } = await twoTeachers();

    const before = await profileRow(owner.profileId);
    const res = await other.agent
      .patch(`/api/profiles/${owner.profileId}`)
      .send({ name: 'hacked' });

    expect(res.status).toBe(404);
    expect(await profileRow(owner.profileId)).toEqual(before);
  });

  it('answers 404 on PATCH isDefault:true; a request that fails changes nothing, no matter who sent it', async () => {
    const { owner, other } = await twoTeachers();

    const ownerBefore = await profileRow(owner.profileId);
    const otherBefore = await profileRow(other.profileId);
    const res = await other.agent
      .patch(`/api/profiles/${owner.profileId}`)
      .send({
        isDefault: true,
      });

    expect(res.status).toBe(404);
    expect(await profileRow(owner.profileId)).toEqual(ownerBefore);
    expect(await profileRow(other.profileId)).toEqual(otherBefore);
  });

  it("answers 404 when other DELETEs owner's profile; archived_at still null", async () => {
    const { owner, other } = await twoTeachers();

    const ownerBefore = await profileRow(owner.profileId);
    const res = await other.agent.delete(`/api/profiles/${owner.profileId}`);

    expect(res.status).toBe(404);
    expect(await profileRow(owner.profileId)).toEqual(ownerBefore);
    expect((await profileRow(owner.profileId)).archived_at).toBeNull();
  });

  it("answers 404 when other archives owner's profile; row unchanged", async () => {
    const { owner, other } = await twoTeachers();

    const ownerBefore = await profileRow(owner.profileId);
    const res = await other.agent.post(
      `/api/profiles/${owner.profileId}/archive`,
    );

    expect(res.status).toBe(404);
    expect(await profileRow(owner.profileId)).toEqual(ownerBefore);
  });

  it("GET /api/profiles lists only the caller's own profiles", async () => {
    const { other } = await twoTeachers();

    const res = await other.agent.get('/api/profiles');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: other.profileId,
        name: "other@example.com's classroom",
        isDefault: true,
        inUse: false,
      },
    ]);
  });
});

/* Test CRUD attempts through `/api/profiles...` before session active:

Calling it with a random uuid and an empty body proves the
401 happens before any parsing or lookup, so it can only
come from requireAuth running first.
*/
describe('profiles: no session', () => {
  it('answers 401 on every profile route without a cookie', async () => {
    const app = createApp();
    const randomId = crypto.randomUUID();

    const responses = [
      await request(app).get('/api/profiles'),
      await request(app).post('/api/profiles').send({}),
      await request(app).get(`/api/profiles/${randomId}`),
      await request(app).patch(`/api/profiles/${randomId}`),
      await request(app).delete(`/api/profiles/${randomId}`),
      await request(app).post(`/api/profiles/${randomId}/archive`),
    ];

    for (const res of responses) {
      expect(res.status).toBe(401);
    }
  });
});

/**
 * Tests the rules for a teacher's own profiles
 */
describe('profiles: one teacher', () => {
  it('moves the default (isDefault: true) to another profile when setting isDefault on a second profile', async () => {
    // first profile defaults to isDefault:true & only one profile can ever be default
    const firstProfile = await teacherWithProfile(createApp(), 't@example.com');
    const secondRes = await firstProfile.agent
      .post('/api/profiles')
      .send({ name: 'Second' });

    const patchRes = await firstProfile.agent
      .patch(`/api/profiles/${secondRes.body.id}`)
      .send({ isDefault: true });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.isDefault).toBe(true);

    const listRes = await firstProfile.agent.get('/api/profiles');
    expect(listRes.body).toEqual([
      { id: secondRes.body.id, name: 'Second', isDefault: true, inUse: false },
      {
        id: firstProfile.profileId,
        name: "t@example.com's classroom",
        isDefault: false,
        inUse: false,
      },
    ]);
  });

  //TODOoOOOO

  it('answers 409 on DELETE while a plan uses the profile, and changes nothing', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    // straight into Postgres: plans route not built yet
    await db('plans').insert({
      teacher_id: user.teacherId,
      profile_id: user.profileId,
      title: 'Monday',
    });

    expect((await user.agent.get('/api/profiles')).body[0].inUse).toBe(true);

    const before = await profileRow(user.profileId);
    const res = await user.agent.delete(`/api/profiles/${user.profileId}`);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'profile in use' });
    expect(await profileRow(user.profileId)).toEqual(before);
  });

  it('counts a block pointing at the profile as in use', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const otherRes = await user.agent
      .post('/api/profiles')
      .send({ name: 'Pull-out group' });
    // the plan uses the first profile; one of its blocks uses the second
    const [plan] = await db('plans')
      .insert({
        teacher_id: user.teacherId,
        profile_id: user.profileId,
        title: 'Monday',
      })
      .returning('id');
    await db('blocks').insert({
      plan_id: plan.id,
      profile_id: otherRes.body.id,
      title: 'Reading',
      start_minutes: 540,
      end_minutes: 600,
    });

    const res = await user.agent.delete(`/api/profiles/${otherRes.body.id}`);
    expect(res.status).toBe(409);
    expect(await profileRow(otherRes.body.id)).toBeDefined();
  });

  it('deletes a profile nothing uses with 204, then 404 on a second DELETE', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');

    const res = await user.agent.delete(`/api/profiles/${user.profileId}`);
    expect(res.status).toBe(204);

    expect((await user.agent.get('/api/profiles')).body).toEqual([]);
    expect(await profileRow(user.profileId)).toBeUndefined();

    const again = await user.agent.delete(`/api/profiles/${user.profileId}`);
    expect(again.status).toBe(404);
    expect(again.body).toEqual({ error: 'profile not found' });
  });

  it('archives a profile a plan uses: hidden, not default, and the plan keeps pointing at it', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const [plan] = await db('plans')
      .insert({
        teacher_id: user.teacherId,
        profile_id: user.profileId,
        title: 'Monday',
      })
      .returning('id');

    const res = await user.agent.post(
      `/api/profiles/${user.profileId}/archive`,
    );
    expect(res.status).toBe(204);

    expect((await user.agent.get('/api/profiles')).body).toEqual([]);
    const row = await profileRow(user.profileId);
    expect(row.archived_at).not.toBeNull();
    expect(row.is_default).toBe(false);

    const planRow = await db('plans').where({ id: plan.id }).first();
    expect(planRow.profile_id).toBe(user.profileId);

    const again = await user.agent.post(
      `/api/profiles/${user.profileId}/archive`,
    );
    expect(again.status).toBe(404);
  });

  it.todo(
    'returns its own notes and contacts on GET :id, and PATCH name keeps them',
  );
  it.todo('answers 400 with fields.name on a blank name, for POST and PATCH');
  it.todo('answers 404, not 500, on a malformed id for GET, PATCH and DELETE');
});
