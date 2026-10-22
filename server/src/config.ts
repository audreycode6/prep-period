const port = Number(process.env.PORT ?? 3001);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`);
}

export const config = {
  port,
  databaseUrl,
  nodeEnv: process.env.NODE_ENV ?? 'development',
} as const;
