/**
 * @profitily/test-support — cross-package test infrastructure (Testcontainers helper
 * + Docker gate). Integration tests in apps/packages import these.
 */
export { startMinio, startPostgres, startValkey } from './containers.js';
export { dockerGate, probeDocker, requireDockerOrThrow } from './docker-gate.js';
export type { DockerGate } from './docker-gate.js';
