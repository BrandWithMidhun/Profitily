import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { verifyShopifyHmac } from './hmac.js';

const SECRET = 'test-shopify-api-secret';

function sign(
  params: Record<string, string>,
  secret = SECRET,
): Record<string, string> {
  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const hmac = createHmac('sha256', secret).update(message).digest('hex');
  return { ...params, hmac };
}

describe('verifyShopifyHmac', () => {
  const base = {
    shop: 'demo.myshopify.com',
    code: 'authcode',
    state: 'nonce',
    timestamp: '1700000000',
  };

  it('accepts a correctly signed query', () => {
    expect(verifyShopifyHmac(sign(base), SECRET)).toBe(true);
  });

  it('rejects when a param is tampered after signing', () => {
    const signed = sign(base);
    expect(verifyShopifyHmac({ ...signed, code: 'evil' }, SECRET)).toBe(false);
  });

  it('rejects a wrong/forged hmac', () => {
    expect(verifyShopifyHmac({ ...base, hmac: 'deadbeef' }, SECRET)).toBe(false);
  });

  it('rejects when hmac is missing', () => {
    expect(verifyShopifyHmac(base, SECRET)).toBe(false);
  });

  it('rejects when signed with a different secret', () => {
    expect(verifyShopifyHmac(sign(base, 'other-secret'), SECRET)).toBe(false);
  });
});
