import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify the HMAC on a Shopify OAuth callback (docs/13 §3/§8). Shopify signs the query
 * params (excluding `hmac` and `signature`), sorted lexicographically and joined as
 * `key=value` with `&`, using HMAC-SHA256 keyed by the app secret. Timing-safe compare.
 * Returns false (never throws) on any mismatch — caller fails closed.
 */
export function verifyShopifyHmac(
  query: Record<string, string | undefined>,
  apiSecret: string,
): boolean {
  const provided = query.hmac;
  if (!provided) return false;

  const pairs: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (key === 'hmac' || key === 'signature') continue;
    pairs.push(`${key}=${value ?? ''}`);
  }
  pairs.sort();
  const message = pairs.join('&');

  const digest = createHmac('sha256', apiSecret).update(message).digest('hex');
  const a = Buffer.from(digest, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
