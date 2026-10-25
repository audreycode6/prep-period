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

describe('auth', () => {
  it('signup -> me -> logout -> me gives 201, 200, 204, 401', async () => {
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

  it('rejects a duplicate email with 409', async () => {
    const agent = request.agent(createApp());
    await signUp(agent);
    const dupeSignUpRes = await signUp(agent);
    expect(dupeSignUpRes.status).toBe(409);
  });

  it('logs in an existing teacher', async () => {
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

  it('answers a wrong password exactly like an unknown email', async () => {
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

  it('treats an expired session as logged out', async () => {
    const agent = request.agent(createApp());
    await signUp(agent);
    expect((await agent.get('/api/auth/me')).status).toBe(200);

    await db('session').update({ expire: new Date(0) }); // Expires session store: gives the request a fresh, empty req.session d
    expect((await agent.get('/api/auth/me')).status).toBe(401); // Prove the server checks Postgres on every request instead of trusting the cookie
  });
});
