import { createHmac } from 'node:crypto';

import type { Env } from '@profitily/shared';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShopifyAuthController } from './shopify-auth.controller.js';
import { ShopifyInstallService } from './shopify-install.service.js';
import type { ShopifyOAuthClient } from './shopify-oauth.client.js';

const SECRET = 'test-shopify-api-secret';
const SHOP = 'demo.myshopify.com';
const STATE = 'state-nonce-123';

const env = {
  NODE_ENV: 'test',
  API_BASE_URL: 'https://api.test',
  SHOPIFY_APP_URL: 'https://app.test',
  SHOPIFY_API_KEY: 'test-api-key',
  SHOPIFY_API_SECRET: SECRET,
  SHOPIFY_SCOPES: 'read_orders,read_products,read_customers',
  SHOPIFY_API_VERSION: '2026-04',
} as unknown as Env;

function signedCallback(overrides: Record<string, string> = {}) {
  const params: Record<string, string> = {
    shop: SHOP,
    code: 'auth-code',
    state: STATE,
    timestamp: '1700000000',
    ...overrides,
  };
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
    cookie: ReturnType<typeof vi.fn>;
    clearCookie: ReturnType<typeof vi.fn>;
  };
  res.status = vi.fn(() => res);
  res.send = vi.fn(() => res);
  res.redirect = vi.fn(() => res);
  res.cookie = vi.fn(() => res);
  res.clearCookie = vi.fn(() => res);
  return res;
}

describe('ShopifyAuthController', () => {
  let client: { exchangeCode: ReturnType<typeof vi.fn>; fetchShop: ReturnType<typeof vi.fn> };
  let installer: { install: ReturnType<typeof vi.fn> };
  let controller: ShopifyAuthController;

  beforeEach(() => {
    client = {
      exchangeCode: vi.fn(async () => 'shpat_stub_token'),
      fetchShop: vi.fn(async () => ({ currency: 'USD', country: 'US', email: 'o@demo.test' })),
    };
    installer = { install: vi.fn(async () => ({ storeId: 'store_1' })) };
    controller = new ShopifyAuthController(
      env,
      client as unknown as ShopifyOAuthClient,
      installer as unknown as ShopifyInstallService,
    );
  });

  describe('install', () => {
    it('rejects an invalid shop without setting a cookie', () => {
      const res = mockRes();
      controller.install('evil.com', res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('sets a signed state cookie and redirects to Shopify authorize', () => {
      const res = mockRes();
      controller.install(SHOP, res);
      expect(res.cookie).toHaveBeenCalledWith(
        'shopify_oauth_state',
        expect.any(String),
        expect.objectContaining({ httpOnly: true, signed: true, sameSite: 'lax' }),
      );
      const url = res.redirect.mock.calls[0]?.[0] as string;
      expect(url).toContain(`https://${SHOP}/admin/oauth/authorize`);
      expect(url).toContain('client_id=test-api-key');
      expect(url).toContain('state=');
    });
  });

  describe('callback — verify order is shop → HMAC → state, fail-closed', () => {
    const cookieReq = (state = STATE) =>
      ({ signedCookies: { shopify_oauth_state: state } }) as unknown as Request;

    it('(a) rejects a bad shop — no exchange, no DB write', async () => {
      const res = mockRes();
      await controller.callback(
        signedCallback({ shop: 'evil.com' }),
        cookieReq(),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(client.exchangeCode).not.toHaveBeenCalled();
      expect(installer.install).not.toHaveBeenCalled();
    });

    it('(b) rejects a bad HMAC — no exchange, no DB write', async () => {
      const res = mockRes();
      const bad = { ...signedCallback(), hmac: 'forged' };
      await controller.callback(bad, cookieReq(), res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(client.exchangeCode).not.toHaveBeenCalled();
      expect(installer.install).not.toHaveBeenCalled();
    });

    it('(c) rejects a state mismatch — no exchange, no DB write', async () => {
      const res = mockRes();
      await controller.callback(
        signedCallback(),
        cookieReq('a-different-nonce'),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(client.exchangeCode).not.toHaveBeenCalled();
      expect(installer.install).not.toHaveBeenCalled();
    });

    it('(c) rejects a missing state cookie — no exchange', async () => {
      const res = mockRes();
      await controller.callback(
        signedCallback(),
        { signedCookies: {} } as unknown as Request,
        res,
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(client.exchangeCode).not.toHaveBeenCalled();
    });

    it('happy path: exchanges, reads shop, provisions, redirects', async () => {
      const res = mockRes();
      await controller.callback(signedCallback(), cookieReq(), res);
      expect(client.exchangeCode).toHaveBeenCalledWith(SHOP, 'auth-code');
      expect(client.fetchShop).toHaveBeenCalledWith(SHOP, 'shpat_stub_token');
      expect(installer.install).toHaveBeenCalledWith(
        expect.objectContaining({
          shopDomain: SHOP,
          accessToken: 'shpat_stub_token',
          baseCurrency: 'USD',
          ownerEmail: 'o@demo.test',
        }),
      );
      expect(res.clearCookie).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalled();
    });
  });
});
