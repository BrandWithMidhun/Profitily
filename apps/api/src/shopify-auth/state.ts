import { randomBytes, timingSafeEqual } from 'node:crypto';

/** A random CSRF state nonce for the OAuth handshake. */
export function generateState(): string {
  return randomBytes(16).toString('base64url');
}

/** Timing-safe equality for the callback state vs the cookie nonce. */
export function statesMatch(
  a: string | undefined,
  b: string | undefined,
): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
