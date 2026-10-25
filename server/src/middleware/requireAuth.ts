import type { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    teacherId?: string;
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.session.teacherId) {
    res.status(401).json({ error: 'not authenticated' });
  } else {
    req.teacherId = req.session.teacherId;
    next();
  }
}
