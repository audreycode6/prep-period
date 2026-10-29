import express from 'express';
import { authRouter } from './routes/auth.js';
import { blocksRouter } from './routes/blocks.js';
import { plansRouter } from './routes/plans.js';
import { profilesRouter } from './routes/profiles.js';
import type { HealthResponse } from '@prep-period/shared';
import { sessionMiddleware } from './middleware/session.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(sessionMiddleware);
  app.use('/api/auth', authRouter);
  app.use('/api/profiles', profilesRouter);
  app.use('/api/plans', plansRouter);
  app.use('/api/blocks', blocksRouter);

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
    res.json(body);
  });
  return app;
}
