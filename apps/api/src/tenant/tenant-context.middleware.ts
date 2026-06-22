import type { NextFunction, Request, Response } from 'express';

/**
 * Per-request tenant-context hook (applied globally in main.ts). Auth is NOT
 * wired yet (TASK-010/011), so this deliberately sets NO storeId — tenant-scoped
 * queries therefore fail closed (the guard rejects them) until a trusted auth
 * layer resolves the tenant.
 *
 * When auth lands, resolve the storeId from the verified session and wrap the
 * downstream handler:
 *
 *   import { runWithStore } from '@profitily/db';
 *   runWithStore(session.storeId, () => next());
 */
export function tenantContextMiddleware(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next();
}
