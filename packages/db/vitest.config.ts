// Vitest config for @profitily/db — consumes the shared preset, and loads the
// repo-root .env so the (reachability-gated) migration tests can find DATABASE_URL.
import { fileURLToPath } from 'node:url';

import preset from '@profitily/config/vitest';

try {
  // Resolve the repo-root .env relative to THIS file (not cwd), so it works no
  // matter where vitest is invoked from. Absent .env (fresh clone / CI without a
  // file) is fine — the migration tests then self-skip on an unreachable DB.
  process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch {
  // no .env file — rely on ambient environment
}

export default preset;
