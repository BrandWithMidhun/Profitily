import { z } from 'zod';

/**
 * Typed, validated environment configuration for the Profitily monorepo.
 *
 * Mirrors `.env.example`. Core infrastructure and crypto vars are validated
 * strictly; integration / Shopify / AI-escalation keys are optional passthrough
 * until their owning tasks tighten them.
 *
 * Security (docs/13 §5): validation fails closed, and error messages name the
 * offending variables only — they never echo a value, so secrets are never
 * leaked through logs or stack traces.
 */

/** "true"/"false" string → boolean, with a default. Anything else fails. */
const booleanFromString = (defaultValue: boolean) =>
  z
    .enum(['true', 'false'])
    .default(defaultValue ? 'true' : 'false')
    .transform((value) => value === 'true');

const postgresUrl = z
  .string()
  .url()
  .refine(
    (value) =>
      value.startsWith('postgresql://') || value.startsWith('postgres://'),
    { message: 'must be a postgresql:// connection URL' },
  );

const redisUrl = z
  .string()
  .url()
  .refine(
    (value) => value.startsWith('redis://') || value.startsWith('rediss://'),
    { message: 'must be a redis:// connection URL' },
  );

export const envSchema = z.object({
  // ── Core ──
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  APP_BASE_URL: z.string().url(),
  API_BASE_URL: z.string().url(),

  // ── Database (Postgres + TimescaleDB) ──
  DATABASE_URL: postgresUrl,

  // ── Cache / queue (Redis or Valkey) ──
  REDIS_URL: redisUrl,

  // ── Object storage (MinIO / S3-compatible) ──
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: booleanFromString(true),

  // ── Email (Mailpit locally) ──
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_FROM: z.string().min(1),

  // ── Auth / crypto ──
  JWT_SECRET: z.string().min(16),
  ENCRYPTION_KEY: z
    .string()
    .min(32, { message: 'must be at least 32 bytes for AES-256' }),

  // ── AI — local-first ──
  OLLAMA_URL: z.string().url(),
  OLLAMA_MODEL: z.string().min(1),
  AI_ESCALATION_ENABLED: booleanFromString(false),

  // ── Optional passthrough (tightened by later tasks) ──
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  SHOPIFY_API_KEY: z.string().optional(),
  SHOPIFY_API_SECRET: z.string().optional(),
  SHOPIFY_SCOPES: z.string().optional(),
  SHOPIFY_APP_URL: z.string().optional(),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  GOOGLE_ADS_CLIENT_ID: z.string().optional(),
  GOOGLE_ADS_CLIENT_SECRET: z.string().optional(),
  TIKTOK_APP_ID: z.string().optional(),
  TIKTOK_APP_SECRET: z.string().optional(),
  SHIPROCKET_EMAIL: z.string().optional(),
  SHIPROCKET_PASSWORD: z.string().optional(),
  SHIPWAY_USERNAME: z.string().optional(),
  SHIPWAY_PASSWORD: z.string().optional(),
  DELHIVERY_API_TOKEN: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  GLITCHTIP_DSN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Build a secret-safe, aggregated error message from a ZodError. Only variable
 * names and validation messages are included — never the offending value.
 */
function formatIssues(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const name = issue.path.join('.') || '(root)';
    return `  - ${name}: ${issue.message}`;
  });
  return `Invalid environment configuration:\n${lines.join('\n')}`;
}

/**
 * Validate and return the typed environment. Throws a single aggregated,
 * secret-safe Error if any variable is missing or invalid.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(formatIssues(result.error));
  }
  return Object.freeze(result.data);
}
