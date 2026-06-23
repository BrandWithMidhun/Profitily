import { createHmac } from 'node:crypto';

import type { Env } from '@profitily/shared';
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RootController } from './root.controller.js';

const SECRET = 'test-shopify-api-secret';
const SHOP = 'demo.myshopify.com';

const env = {
  NODE_ENV: 'test',
  API_BASE_URL: 'https://api.test',
  SHOPIFY_APP_URL: 'https://app.test',
  SHOPIFY_API_KEY: 'test-api-key',
  SHOPIFY_API_SECRET: SECRET,
  SHOPIFY_SCOPES: 'read_orders,read_products,read_customers',
  SHOPIFY_API_VERSION: '2026-04',
} as unknown as Env;

function signed(params: Record<string, string>): Record<string, string> {
  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return {
    ...params,
    hmac: createHmac('sha256', SECRET).update(message).digest('hex'),
  };
}

function mockRes() {
  const res = {} as Response & {
    status: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    redirect: ReturnType<typeof vi.fn>;
  };
  res.status = vi.fn(() => res);
  res.send = vi.fn(() => res);
  res.redirect = vi.fn(() => res);
  return res;
}

describe('RootController (App URL entrypoint)', () => {
  let controller: RootController;

  beforeEach(() => {
    controller = new RootController(env);
  });

  it('redirects a verified Shopify hit into the install flow', () => {
    const res = mockRes();
    controller.root(
      signed({ shop: SHOP, host: 'abc', timestamp: '1700000000' }),
      res,
    );
    const url = res.redirect.mock.calls[0]?.[0] as string;
    expect(url).toBe(`/auth/shopify/install?shop=${encodeURIComponent(SHOP)}`);
    expect(res.status).not.toHaveBeenCalledWith(401);
  });

  it('rejects a bad HMAC — no redirect into install', () => {
    const res = mockRes();
    controller.root(
      { shop: SHOP, host: 'abc', timestamp: '1700000000', hmac: 'forged' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('rejects a shop hit with a missing HMAC', () => {
    const res = mockRes();
    controller.root({ shop: SHOP, host: 'abc' }, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('rejects an invalid shop domain', () => {
    const res = mockRes();
    controller.root(signed({ shop: 'evil.com' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('serves a neutral 200 landing with no shop param (no redirect)', () => {
    const res = mockRes();
    controller.root({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.redirect).not.toHaveBeenCalled();
  });
});
