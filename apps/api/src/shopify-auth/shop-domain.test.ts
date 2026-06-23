import { describe, expect, it } from 'vitest';

import { parseShopDomain } from './shop-domain.js';

describe('parseShopDomain', () => {
  it('accepts a valid *.myshopify.com domain (lowercased)', () => {
    expect(parseShopDomain('Demo-Store.myshopify.com')).toBe(
      'demo-store.myshopify.com',
    );
  });

  it.each([
    'evil.com',
    'demo.myshopify.com.evil.com',
    'myshopify.com',
    'demo.example.com',
    'https://demo.myshopify.com',
    '',
    undefined,
    123,
  ])('rejects %s', (value) => {
    expect(parseShopDomain(value)).toBeNull();
  });
});
