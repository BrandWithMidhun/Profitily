import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

/** A complete, valid environment to base individual cases on. */
function validEnv(): Record<string, string> {
  return {
    NODE_ENV: 'test',
    APP_BASE_URL: 'http://localhost:3000',
    API_BASE_URL: 'http://localhost:3001',
    DATABASE_URL: 'postgresql://profitily:profitily@localhost:5432/profitily',
    REDIS_URL: 'redis://localhost:6379',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'us-east-1',
    S3_BUCKET: 'profitily-reports',
    S3_ACCESS_KEY: 'minioadmin',
    S3_SECRET_KEY: 'minioadmin',
    S3_FORCE_PATH_STYLE: 'true',
    SMTP_HOST: 'localhost',
    SMTP_PORT: '1025',
    SMTP_FROM: 'Profitily <reports@profitily.local>',
    JWT_SECRET: 'change-me-dev-only',
    ENCRYPTION_KEY: 'change-me-32-byte-dev-key-000000',
    OLLAMA_URL: 'http://localhost:11434',
    OLLAMA_MODEL: 'llama3.1',
    AI_ESCALATION_ENABLED: 'false',
  };
}

describe('loadEnv — valid input', () => {
  it('parses a complete environment into a typed object', () => {
    const env = loadEnv(validEnv());
    expect(env.DATABASE_URL).toContain('postgresql://');
    expect(env.S3_BUCKET).toBe('profitily-reports');
  });

  it('coerces SMTP_PORT to a number', () => {
    const env = loadEnv(validEnv());
    expect(env.SMTP_PORT).toBe(1025);
    expect(typeof env.SMTP_PORT).toBe('number');
  });

  it('coerces "true"/"false" strings to booleans', () => {
    const env = loadEnv({
      ...validEnv(),
      S3_FORCE_PATH_STYLE: 'false',
      AI_ESCALATION_ENABLED: 'true',
    });
    expect(env.S3_FORCE_PATH_STYLE).toBe(false);
    expect(env.AI_ESCALATION_ENABLED).toBe(true);
  });

  it('returns a frozen object', () => {
    const env = loadEnv(validEnv());
    expect(Object.isFrozen(env)).toBe(true);
  });
});

describe('loadEnv — defaults', () => {
  it('applies defaults when optional-with-default vars are omitted', () => {
    const base = validEnv();
    delete base.NODE_ENV;
    delete base.S3_REGION;
    delete base.S3_FORCE_PATH_STYLE;
    delete base.AI_ESCALATION_ENABLED;

    const env = loadEnv(base);
    expect(env.NODE_ENV).toBe('development');
    expect(env.S3_REGION).toBe('us-east-1');
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
    expect(env.AI_ESCALATION_ENABLED).toBe(false);
  });

  it('treats integration keys as optional', () => {
    const env = loadEnv(validEnv());
    expect(env.SHOPIFY_API_KEY).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });
});

describe('loadEnv — invalid input fails closed', () => {
  it('throws naming a missing required var', () => {
    const base = validEnv();
    delete base.DATABASE_URL;
    expect(() => loadEnv(base)).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-postgres DATABASE_URL', () => {
    expect(() =>
      loadEnv({ ...validEnv(), DATABASE_URL: 'mysql://localhost:3306/db' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-redis REDIS_URL', () => {
    expect(() =>
      loadEnv({ ...validEnv(), REDIS_URL: 'http://localhost:6379' }),
    ).toThrow(/REDIS_URL/);
  });

  it('rejects a non-numeric SMTP_PORT', () => {
    expect(() =>
      loadEnv({ ...validEnv(), SMTP_PORT: 'not-a-port' }),
    ).toThrow(/SMTP_PORT/);
  });

  it('rejects a too-short ENCRYPTION_KEY', () => {
    expect(() =>
      loadEnv({ ...validEnv(), ENCRYPTION_KEY: 'too-short' }),
    ).toThrow(/ENCRYPTION_KEY/);
  });

  it('rejects an invalid boolean string', () => {
    expect(() =>
      loadEnv({ ...validEnv(), AI_ESCALATION_ENABLED: 'yes' }),
    ).toThrow(/AI_ESCALATION_ENABLED/);
  });

  it('aggregates multiple errors into one message', () => {
    const base = validEnv();
    delete base.DATABASE_URL;
    delete base.REDIS_URL;
    let message = '';
    try {
      loadEnv(base);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('REDIS_URL');
  });
});

describe('loadEnv — secret safety', () => {
  it('names the offending secret var but never echoes its value', () => {
    const distinctiveSecret = 'xQ7zLeakMarker';
    let message = '';
    try {
      // Too short for JWT_SECRET (min 16) → fails, but the value must not leak.
      loadEnv({ ...validEnv(), JWT_SECRET: distinctiveSecret });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('JWT_SECRET');
    expect(message).not.toContain(distinctiveSecret);
  });
});
