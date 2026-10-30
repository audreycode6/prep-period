import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { db } from '../db.js';
import { sessionStore } from '../middleware/session.js';
import { teacherWithProfile, twoTeachers } from '../test/teachers.js';

beforeEach(async () => {
  await db.raw('truncate table teachers, session cascade');
});

afterAll(async () => {
  await sessionStore.close(); // connect-pg-simple's pool
  await db.destroy(); // knex's pool
});

/** One entry in each of a profile's four lists, for tests that check them. */
const PROFILE_LISTS = {
  schoolInfo: [{ label: 'Bell', note: 'Rings at 8:05' }],
  contacts: [{ name: 'Ms. Lee', role: 'Principal', reach: 'ext. 201' }],
  classroomNotes: [{ label: 'Lights', note: 'Switch by the door' }],
  studentNotes: [{ label: 'Sam', note: 'Leaves at 9:15 on Tuesdays' }],
};

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
        isArchived: false,
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
      {
        id: secondRes.body.id,
        name: 'Second',
        isDefault: true,
        inUse: false,
        isArchived: false,
      },
      {
        id: firstProfile.profileId,
        name: "t@example.com's classroom",
        isDefault: false,
        inUse: false,
        isArchived: false,
      },
    ]);
  });

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

  it('answers 409 on deleting the default while another profile exists, then deletes once the default moves', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const secondRes = await user.agent
      .post('/api/profiles')
      .send({ name: 'Second' });

    const before = await profileRow(user.profileId);
    const res = await user.agent.delete(`/api/profiles/${user.profileId}`);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'choose a new default first' });
    expect(await profileRow(user.profileId)).toEqual(before);

    // move the default to the second profile, then delete
    await user.agent
      .patch(`/api/profiles/${secondRes.body.id}`)
      .send({ isDefault: true });
    const retry = await user.agent.delete(`/api/profiles/${user.profileId}`);
    expect(retry.status).toBe(204);
  });

  it('answers 409 on archiving the default while another profile exists, then archives once the default moves', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const secondRes = await user.agent
      .post('/api/profiles')
      .send({ name: 'Second' });

    const before = await profileRow(user.profileId);
    const res = await user.agent.post(
      `/api/profiles/${user.profileId}/archive`,
    );
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'choose a new default first' });
    expect(await profileRow(user.profileId)).toEqual(before);

    await user.agent
      .patch(`/api/profiles/${secondRes.body.id}`)
      .send({ isDefault: true });
    const retry = await user.agent.post(
      `/api/profiles/${user.profileId}/archive`,
    );
    expect(retry.status).toBe(204);
  });

  it('answers 409 on PATCH isDefault: false on the default, even when it is the only profile', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');

    const before = await profileRow(user.profileId);
    const res = await user.agent
      .patch(`/api/profiles/${user.profileId}`)
      .send({ isDefault: false });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'choose a new default first' });
    expect(await profileRow(user.profileId)).toEqual(before);
  });

  it('returns its own notes and contacts on GET :id, and PATCH name keeps them', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const created = await user.agent
      .post('/api/profiles')
      .send({ name: 'Room 12', ...PROFILE_LISTS });

    const read = await user.agent.get(`/api/profiles/${created.body.id}`);
    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({ name: 'Room 12', ...PROFILE_LISTS });

    const patched = await user.agent
      .patch(`/api/profiles/${created.body.id}`)
      .send({ name: 'Room 14' });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ name: 'Room 14', ...PROFILE_LISTS });
  });

  it('replaces the lists sent on PATCH and leaves the lists not sent unchanged', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    const created = await user.agent
      .post('/api/profiles')
      .send({ name: 'Room 12', ...PROFILE_LISTS });

    const patched = await user.agent
      .patch(`/api/profiles/${created.body.id}`)
      .send({
        contacts: [{ name: 'Mr. Diaz', role: 'Counselor', reach: 'ext. 310' }],
      });

    const expected = {
      name: 'Room 12',
      ...PROFILE_LISTS,
      contacts: [{ name: 'Mr. Diaz', role: 'Counselor', reach: 'ext. 310' }],
    };
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject(expected);
    const read = await user.agent.get(`/api/profiles/${created.body.id}`);
    expect(read.body).toMatchObject(expected);
  });

  it('answers 404 on GET :id and PATCH for an archived profile, and changes nothing', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');
    await user.agent.post(`/api/profiles/${user.profileId}/archive`);

    const before = await profileRow(user.profileId);
    const read = await user.agent.get(`/api/profiles/${user.profileId}`);
    const patched = await user.agent
      .patch(`/api/profiles/${user.profileId}`)
      .send({ name: 'Renamed' });

    expect(read.status).toBe(404);
    expect(patched.status).toBe(404);
    expect(await profileRow(user.profileId)).toEqual(before);
  });

  it('moves the default when a second profile is created with isDefault: true', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');

    const res = await user.agent
      .post('/api/profiles')
      .send({ name: 'Second', isDefault: true });

    expect(res.status).toBe(201);
    expect(res.body.isDefault).toBe(true);
    expect((await profileRow(user.profileId)).is_default).toBe(false);
  });
});

/* Test input the schemas or the id check refuse:
 each one is answered with a 400 before any query runs.
 */
describe('profiles: bad input', () => {
  it('answers 400 with fields.name on a blank name, for POST and PATCH', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');

    const before = await profileRow(user.profileId);
    const created = await user.agent.post('/api/profiles').send({ name: '  ' });
    const patched = await user.agent
      .patch(`/api/profiles/${user.profileId}`)
      .send({ name: '' });

    for (const res of [created, patched]) {
      expect(res.status).toBe(400);
      expect(res.body.fields).toEqual({ name: ['Name is required'] });
    }
    expect(await profileRow(user.profileId)).toEqual(before);
    expect(
      await db('classroom_profiles').where({ teacher_id: user.teacherId }),
    ).toHaveLength(1);
  });

  it('answers 404 on a malformed id for GET, PATCH, DELETE and archive', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');

    const responses = [
      await user.agent.get('/api/profiles/not-a-uuid'),
      await user.agent.patch('/api/profiles/not-a-uuid').send({ name: 'x' }),
      await user.agent.delete('/api/profiles/not-a-uuid'),
      await user.agent.post('/api/profiles/not-a-uuid/archive'),
    ];

    for (const res of responses) {
      expect(res.status).toBe(404);
    }
  });

  it('answers 400 naming the list in fields when a contact or note entry is missing a required field', async () => {
    const user = await teacherWithProfile(createApp(), 'user@example.com');

    const res = await user.agent.post('/api/profiles').send({
      name: 'Room 12',
      contacts: [{ name: 'Ms. Lee' }],
      studentNotes: [{ label: 'Sam' }],
    });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual([
      'contacts',
      'studentNotes',
    ]);
    expect(
      await db('classroom_profiles').where({ teacher_id: user.teacherId }),
    ).toHaveLength(1);
  });
});
