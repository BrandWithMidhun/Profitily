/**
 * Docker-availability gate for Testcontainers-based suites — mirrors the DB gate
 * (packages/db). Locally with no Docker the suite SKIPs (clean, visible); in CI
 * (`CI=true`) or with `REQUIRE_DOCKER=1` an unavailable Docker FAILS loudly so the
 * integration suite never silently skips.
 *
 * `probeDocker` never throws (safe for `describe.skipIf`); `requireDockerOrThrow`
 * is called inside `beforeAll` so an absent Docker fails as a hook, not at collection.
 */
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export type DockerGate = { available: boolean; skip: boolean };

function dockerRequired(): boolean {
  return process.env.CI === 'true' || process.env.REQUIRE_DOCKER === '1';
}

export async function probeDocker(): Promise<boolean> {
  try {
    await execAsync('docker info', { timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

export async function dockerGate(): Promise<DockerGate> {
  const available = await probeDocker();
  return { available, skip: !available && !dockerRequired() };
}

export function requireDockerOrThrow(gate: DockerGate): void {
  if (!gate.available) {
    throw new Error(
      '[docker-gate] Docker is unavailable, but it is REQUIRED here (CI=true or ' +
        'REQUIRE_DOCKER=1). The integration suite must run — failing loudly instead ' +
        'of skipping.',
    );
  }
}
