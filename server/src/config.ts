const port = Number(process.env.PORT ?? 3001);
const databaseUrl = process.env.DATABASE_URL;
const sessionSecret = process.env.SESSION_SECRET;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`);
}

if (!sessionSecret) {
  throw new Error('SESSION_SECRET is not set');
}

export const config = {
  port,
  databaseUrl,
  sessionSecret,
  nodeEnv: process.env.NODE_ENV ?? 'development',
} as const;
