import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const envFile = new URL('../.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  test: {
    globalSetup: './src/test/globalSetup.ts',
    env: { NODE_ENV: 'test' },
  },
});
