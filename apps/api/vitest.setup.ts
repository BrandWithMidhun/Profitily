// Test setup: register reflect-metadata (Nest DI) and provide a hermetic,
// valid-but-dummy environment so `loadEnv()` succeeds without a real .env or
// infra. The DB is never connected in these tests (Prisma connects lazily).
import 'reflect-metadata';

/* Keys are a fixed, in-repo allowlist (not user input), so the object-injection
   rule is a false positive here. */
/* eslint-disable security/detect-object-injection */

const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  APP_BASE_URL: 'http://localhost:3000',
  API_BASE_URL: 'http://localhost:3001',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'test-bucket',
  S3_ACCESS_KEY: 'test-access-key',
  S3_SECRET_KEY: 'test-secret-key',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_FROM: 'test@example.com',
  JWT_SECRET: 'test-jwt-secret-at-least-16',
  ENCRYPTION_KEY: 'test-encryption-key-of-32-bytes!!',
  OLLAMA_URL: 'http://localhost:11434',
  OLLAMA_MODEL: 'llama3.1',
};

for (const [key, value] of Object.entries(defaults)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}
