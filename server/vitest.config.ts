import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const envFile = new URL('../.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  test: {
    globalSetup: './src/test/globalSetup.ts',
    env: { NODE_ENV: 'test' },
    fileParallelism: false, // every file shares prep_period_test; parallel truncates would wipe each other's rows
  },
});
