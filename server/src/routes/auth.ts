import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcrypt';
import type { SignupRequest, Teacher } from '@prep-period/shared';
import { insertTeacher, toTeacher } from '../db/teachers.js';

export const authRouter = Router();

type ApiError = { error: string };

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
    const { email, password } = req.body;
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email ||
      !password
    ) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

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
