#!/usr/bin/env node
// Run a workspace package script with the environment already loaded by the
// caller. Invoke as:
//   node --env-file-if-exists=.env tooling/run-pkg.mjs <package> <script> [args]
//
// Prisma commands live in packages/db and read DATABASE_URL from the process
// environment; Prisma's own .env discovery does NOT walk up to the monorepo
// root, so we load the repo-root .env here (via Node's --env-file) and let the
// spawned child inherit it. Cross-platform; tolerates a missing .env.
import { spawnSync } from 'node:child_process';

const [pkg, script, ...rest] = process.argv.slice(2);
if (!pkg || !script) {
  console.error('usage: run-pkg.mjs <package> <script> [args...]');
  process.exit(2);
}

const result = spawnSync('pnpm', ['--filter', pkg, script, ...rest], {
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
