import request from 'supertest';
import { createApp } from '../app.js';

export type Agent = ReturnType<typeof request.agent>;

/**
 * Signs a teacher up through the real route and creates one profile.
 * Returns what the tests need: the logged-in agent, the teacher's id
 * , and the profile's id.
 */
export async function teacherWithProfile(
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

export async function twoTeachers() {
  const app = createApp();
  const owner = await teacherWithProfile(app, 'owner@example.com');
  const other = await teacherWithProfile(app, 'other@example.com');
  return {
    app,
    owner,
    other,
  };
}
