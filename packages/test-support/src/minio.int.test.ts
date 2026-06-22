import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startMinio } from './containers.js';
import { dockerGate, requireDockerOrThrow } from './docker-gate.js';

const gate = await dockerGate();
if (gate.skip) {
  console.warn('[minio.int] Docker unavailable — skipping. Set REQUIRE_DOCKER=1 to force.');
}

describe.skipIf(gate.skip)('integration: MinIO (Testcontainers)', () => {
  let stop: () => Promise<unknown>;
  let s3: S3Client;

  beforeAll(async () => {
    requireDockerOrThrow(gate);
    const minio = await startMinio();
    stop = () => minio.container.stop();
    s3 = new S3Client({
      endpoint: minio.endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: minio.accessKey, secretAccessKey: minio.secretKey },
    });
  });

  afterAll(async () => {
    s3?.destroy();
    await stop?.();
  });

  it('creates and heads a bucket', async () => {
    await s3.send(new CreateBucketCommand({ Bucket: 'harness-probe' }));
    const head = await s3.send(new HeadBucketCommand({ Bucket: 'harness-probe' }));
    expect(head.$metadata.httpStatusCode).toBe(200);
  });
});
