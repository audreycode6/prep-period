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

type Agent = ReturnType<typeof request.agent>; //  built on top of SuperAgent, allowing you to chain methods while preserving cookies and headers

const EMAIL = 't@example.com';
const PASSWORD = 'supercoolpw';

/**
 *  Signs up through the real route;
 * the agent keeps the cookie it gets back
 */
async function signUp(agent: Agent, email = EMAIL, password = PASSWORD) {
  return agent.post('/api/auth/signup').send({
    email,
    password,
  });
}

/**
 *
 * @returns Check count of rows in PostgreSQL 'session' table
 */
async function sessionCount(): Promise<number> {
  const [{ count }] = await db('session').count({ count: '*' });
  return Number(count);
}

/* Test the session through the real auth routes:
 signup and login start one, logout ends it, and /me answers 200 only while
 both the session and its teacher still exist. Bad credentials are refused
 without saying which part was wrong.
 */
describe('auth', () => {
  it('answers 201 on signup, 200 on /me, 204 on logout, then 401 on /me', async () => {
    const agent = request.agent(createApp());

    const signUpRes = await signUp(agent);
    expect(signUpRes.status).toBe(201);
    expect(signUpRes.body).toEqual({
      id: expect.any(String),
      email: EMAIL,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(await sessionCount()).toBe(1);

    const meLoggedInRes = await agent.get('/api/auth/me');
    expect(meLoggedInRes.status).toBe(200);

    const logoutRes = await agent.post('/api/auth/logout');
    expect(logoutRes.status).toBe(204);
    expect(await sessionCount()).toBe(0);

    const meLoggedOutRes = await agent.get('/api/auth/me');
    expect(meLoggedOutRes.status).toBe(401);
  });

  it('answers 409 on signup with an email that is already registered', async () => {
    const agent = request.agent(createApp());
    await signUp(agent);
    const dupeSignUpRes = await signUp(agent);
    expect(dupeSignUpRes.status).toBe(409);
  });

  it('answers 409 on signup and 200 on login for an email that differs only in case', async () => {
    const app = createApp();
    await signUp(request.agent(app), 'owner@example.com');

    const dupeSignUpRes = await signUp(request.agent(app), 'Owner@Example.com');
    const logInRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'OWNER@example.com', password: PASSWORD });

    expect(dupeSignUpRes.status).toBe(409);
    expect(logInRes.status).toBe(200);
    expect(logInRes.body.email).toBe('owner@example.com');
  });

  it('answers 400 on signup and login when the email or password is missing or empty', async () => {
    const app = createApp();
    const bodies = [
      {},
      { email: EMAIL },
      { password: PASSWORD },
      { email: '', password: PASSWORD },
      { email: EMAIL, password: '' },
    ];

    for (const path of ['/api/auth/signup', '/api/auth/login']) {
      for (const body of bodies) {
        const res = await request(app).post(path).send(body);
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'email and password are required' });
      }
    }
    expect(await db('teachers')).toEqual([]);
  });

  it('answers 200 on login for an existing teacher, and the new session works on /me', async () => {
    const app = createApp();
    await signUp(request.agent(app));
    const agent = request.agent(app);
    const existingLogInRes = await agent
      .post('/api/auth/login')
      .send({ email: EMAIL, password: PASSWORD });
    expect(existingLogInRes.status).toBe(200);
    expect(existingLogInRes.body.email).toEqual(EMAIL);

    const loggedInCookieRes = await agent.get('/api/auth/me');
    expect(loggedInCookieRes.status).toBe(200);
  });

  it('answers 401 with the same error for a wrong password and an unknown email', async () => {
    const app = createApp();
    await signUp(request.agent(app)); // signUp first (so the email exists)
    const wrongPasswordRes = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: 'nope' });
    const unknownEmailRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'nope' });
    expect(wrongPasswordRes.status).toBe(401);
    expect(unknownEmailRes.status).toBe(401);
    expect(wrongPasswordRes.body).toEqual(unknownEmailRes.body);
  });

  it('answers 401 on /me once the session has expired', async () => {
    const agent = request.agent(createApp());
    await signUp(agent);
    expect((await agent.get('/api/auth/me')).status).toBe(200);

    await db('session').update({ expire: new Date(0) }); // Expires session store: gives the request a fresh, empty req.session d
    expect((await agent.get('/api/auth/me')).status).toBe(401); // Prove the server checks Postgres on every request instead of trusting the cookie
  });

  it("answers 401 on /me when the session's teacher no longer exists", async () => {
    const agent = request.agent(createApp());
    const signUpRes = await signUp(agent);

    await db('teachers').where({ id: signUpRes.body.id }).del();

    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});
