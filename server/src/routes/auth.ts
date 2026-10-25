import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcrypt';
import type { SignupRequest, Teacher, LoginRequest } from '@prep-period/shared';
import {
  insertTeacher,
  toTeacher,
  findTeacherByEmail,
  findTeacherById,
} from '../db/teachers.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { SESSION_COOKIE } from '../middleware/session.js';

export const authRouter = Router();

type ApiError = { error: string };

function hasCredentials(
  body: Partial<SignupRequest> | undefined,
): body is SignupRequest {
  return (
    typeof body?.email === 'string' &&
    typeof body?.password === 'string' &&
    body.email !== '' &&
    body.password !== ''
  );
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

authRouter.post(
  '/signup',
  async (
    req: Request<
      Record<string, never>,
      Teacher | ApiError,
      Partial<SignupRequest>
    >,
    res: Response<Teacher | ApiError>,
  ) => {
    if (!hasCredentials(req.body)) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }
    const { email, password } = req.body;

    const passwordHash = await bcrypt.hash(password, 10);
    const row = await insertTeacher(email, passwordHash);

    if (!row) {
      res.status(409).json({ error: 'email already registered' });
      return;
    }

    req.session.teacherId = row.id;
    res.status(201).json(toTeacher(row));
  },
);

authRouter.post(
  '/login',
  async (
    req: Request<
      Record<string, never>,
      Teacher | ApiError,
      Partial<LoginRequest>
    >,
    res: Response<Teacher | ApiError>,
  ) => {
    if (!hasCredentials(req.body)) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }
    const { email, password } = req.body;

    const row = await findTeacherByEmail(email);
    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      res.status(401).json({ error: 'invalid email or password' });
      return;
    }

    await regenerateSession(req);
    req.session.teacherId = row.id;
    res.json(toTeacher(row));
  },
);

authRouter.post('/logout', async (req, res) => {
  await destroySession(req);
  res.clearCookie(SESSION_COOKIE);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const row = await findTeacherById(req.teacherId!);
  if (!row) {
    res.status(401).json({ error: 'not authenticated' });
    return;
  }
  res.status(200).json(toTeacher(row));
});
