import express from 'express';
import type { HealthResponse } from '@prep-period/shared';

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
    res.json(body);
  });
  return app;
}
