/**
 * Asserts the ACTUAL emitted Set-Cookie header for the install begin-route in
 * staging/prod mode (NODE_ENV != development): the OAuth state cookie must be
 * `SameSite=None; Secure; Partitioned; HttpOnly` so it survives the cross-site OAuth
 * return from Shopify (TASK-010 completion).
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Env } from '@profitily/shared';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ENV } from '../config/config.module.js';

import { ShopifyAuthController } from './shopify-auth.controller.js';
import { ShopifyInstallService } from './shopify-install.service.js';
import { SHOPIFY_OAUTH_CLIENT } from './shopify-oauth.client.js';

const env = {
  NODE_ENV: 'production',
  API_BASE_URL: 'https://api.test',
  SHOPIFY_APP_URL: 'https://app.test',
  SHOPIFY_API_KEY: 'test-api-key',
  SHOPIFY_API_SECRET: 'test-api-secret',
  SHOPIFY_SCOPES: 'read_orders,read_products,read_customers',
  SHOPIFY_API_VERSION: '2026-04',
} as unknown as Env;

describe('install begin-route — emitted Set-Cookie (staging/prod)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ShopifyAuthController],
      providers: [
        { provide: ENV, useValue: env },
        { provide: SHOPIFY_OAUTH_CLIENT, useValue: {} },
        { provide: ShopifyInstallService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser('test-cookie-secret'));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('sets SameSite=None; Secure; Partitioned; HttpOnly on the state cookie', async () => {
    const res = await request(app.getHttpServer()).get(
      '/auth/shopify/install?shop=demo.myshopify.com',
    );

    expect(res.status).toBe(302);
    const setCookie = res.headers['set-cookie'];
    const header = Array.isArray(setCookie) ? setCookie.join('\n') : String(setCookie);

    expect(header).toContain('shopify_oauth_state=');
    expect(header).toMatch(/SameSite=None/i);
    expect(header).toMatch(/(^|;|\s)Secure(;|$|\s)/i);
    expect(header).toMatch(/Partitioned/i);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toContain('Path=/auth/shopify');
  });
});
