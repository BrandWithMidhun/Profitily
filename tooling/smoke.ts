/**
 * Connectivity smoke check for the local infra plane (TASK-002).
 *
 * Validates env via @profitily/shared, then connects to each core service and
 * reports health. Non-destructive. Exits non-zero if any check fails.
 *
 * Run: pnpm smoke   (loads .env if present)
 *
 * Output is redacted by design — service names and pass/fail only, never
 * connection strings or credentials (docs/13 §5).
 */
import net from 'node:net';

import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { loadEnv } from '@profitily/shared';
import pg from 'pg';

const { Client } = pg;

const CHECK_TIMEOUT_MS = 5000;

type CheckResult = { name: string; ok: boolean; detail: string };

function timeout(ms: number, label: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
  );
}

/** Open a TCP socket, run `onConnect`, and resolve with the first data chunk. */
function tcpProbe(
  host: string,
  port: number,
  onConnect: (socket: net.Socket) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let buffer = '';
    socket.setEncoding('utf8');
    socket.on('connect', () => onConnect(socket));
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      socket.end();
    });
    socket.on('end', () => resolve(buffer));
    socket.on('error', (err) => reject(err));
  });
}

async function checkPostgres(databaseUrl: string): Promise<string> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('SELECT 1');
    const { rows } = await client.query<{ default_version: string }>(
      `SELECT default_version FROM pg_available_extensions WHERE name = 'timescaledb'`,
    );
    if (rows.length === 0) {
      throw new Error('TimescaleDB extension is not available');
    }
    return `SELECT 1 ok; timescaledb v${rows[0]?.default_version} available`;
  } finally {
    await client.end();
  }
}

async function checkRedis(redisUrl: string): Promise<string> {
  const url = new URL(redisUrl);
  const host = url.hostname;
  const port = Number(url.port || 6379);
  const reply = await tcpProbe(host, port, (socket) =>
    socket.write('PING\r\n'),
  );
  if (!reply.startsWith('+PONG')) {
    throw new Error(`unexpected PING reply: ${JSON.stringify(reply.slice(0, 16))}`);
  }
  return 'PING → PONG';
}

type S3Config = {
  endpoint: string;
  region: string;
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

async function checkMinio(cfg: S3Config): Promise<string> {
  // 1) Server liveness (unauthenticated health endpoint).
  const res = await fetch(`${cfg.endpoint.replace(/\/$/, '')}/minio/health/live`);
  if (!res.ok) {
    throw new Error(`health/live returned HTTP ${res.status}`);
  }

  // 2) The reports bucket exists. Anonymous requests get 403 whether or not the
  //    bucket exists, so this needs an authenticated HeadBucket.
  const s3 = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    forcePathStyle: cfg.forcePathStyle,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  try {
    await s3.send(new HeadBucketCommand({ Bucket: cfg.bucket }));
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;
    if (status === 404) {
      throw new Error(`bucket "${cfg.bucket}" not found`);
    }
    throw err;
  } finally {
    s3.destroy();
  }

  return `health/live HTTP ${res.status}; bucket "${cfg.bucket}" exists`;
}

async function checkMailpit(host: string, port: number): Promise<string> {
  const greeting = await tcpProbe(host, port, (socket) =>
    socket.write('QUIT\r\n'),
  );
  if (!greeting.startsWith('220')) {
    throw new Error(
      `unexpected SMTP greeting: ${JSON.stringify(greeting.slice(0, 16))}`,
    );
  }
  return 'SMTP 220 greeting';
}

async function run(): Promise<void> {
  let env: ReturnType<typeof loadEnv>;
  try {
    env = loadEnv();
  } catch (err) {
    // loadEnv produces a secret-safe, aggregated message.
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const smtpHost = env.SMTP_HOST;
  const smtpPort = env.SMTP_PORT;

  const checks: { name: string; run: () => Promise<string> }[] = [
    { name: 'postgres', run: () => checkPostgres(env.DATABASE_URL) },
    { name: 'redis (valkey)', run: () => checkRedis(env.REDIS_URL) },
    {
      name: 'minio',
      run: () =>
        checkMinio({
          endpoint: env.S3_ENDPOINT,
          region: env.S3_REGION,
          forcePathStyle: env.S3_FORCE_PATH_STYLE,
          accessKeyId: env.S3_ACCESS_KEY,
          secretAccessKey: env.S3_SECRET_KEY,
          bucket: env.S3_BUCKET,
        }),
    },
    { name: 'mailpit', run: () => checkMailpit(smtpHost, smtpPort) },
  ];

  const results: CheckResult[] = [];
  for (const check of checks) {
    try {
      const detail = await Promise.race([
        check.run(),
        timeout(CHECK_TIMEOUT_MS, check.name),
      ]);
      results.push({ name: check.name, ok: true, detail });
    } catch (err) {
      results.push({
        name: check.name,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log('\nProfitily local infra smoke check');
  console.log('─'.repeat(48));
  for (const r of results) {
    const mark = r.ok ? '✓' : '✗';
    console.log(`${mark} ${r.name.padEnd(16)} ${r.detail}`);
  }
  console.log('─'.repeat(48));

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`\n${failed.length} service(s) unhealthy.`);
    process.exit(1);
  }
  console.log('\nAll core services healthy.');
}

void run();
