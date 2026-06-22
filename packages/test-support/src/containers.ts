/**
 * Testcontainers helper — spins ephemeral Postgres+Timescale, Valkey, and MinIO for
 * integration tests, pinned to the same images as tooling/docker-compose.yml (TASK-002)
 * for parity. Each starter returns the container handle + connection info; the caller
 * stops the container in afterAll. Requires Docker (see docker-gate.ts).
 */
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from 'testcontainers';

const TIMESCALE_IMAGE = 'timescale/timescaledb:2.17.2-pg16';
const VALKEY_IMAGE = 'valkey/valkey:8.0.2-alpine';
const MINIO_IMAGE = 'minio/minio:RELEASE.2025-04-22T22-12-26Z';

export async function startPostgres() {
  const container = await new PostgreSqlContainer(TIMESCALE_IMAGE)
    .withDatabase('profitily')
    .withUsername('profitily')
    .withPassword('profitily')
    .start();
  return { container, url: container.getConnectionUri() };
}

export async function startValkey(): Promise<{
  container: StartedTestContainer;
  url: string;
}> {
  const container = await new GenericContainer(VALKEY_IMAGE)
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
    .start();
  const url = `redis://${container.getHost()}:${container.getMappedPort(6379)}`;
  return { container, url };
}

export async function startMinio(): Promise<{
  container: StartedTestContainer;
  endpoint: string;
  accessKey: string;
  secretKey: string;
}> {
  const container = await new GenericContainer(MINIO_IMAGE)
    .withEnvironment({
      MINIO_ROOT_USER: 'minioadmin',
      MINIO_ROOT_PASSWORD: 'minioadmin',
    })
    .withCommand(['server', '/data'])
    .withExposedPorts(9000)
    .withWaitStrategy(Wait.forHttp('/minio/health/live', 9000))
    .start();
  const endpoint = `http://${container.getHost()}:${container.getMappedPort(9000)}`;
  return { container, endpoint, accessKey: 'minioadmin', secretKey: 'minioadmin' };
}
