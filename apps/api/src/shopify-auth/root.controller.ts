import { Controller, Get, Inject, Query, Res } from '@nestjs/common';
import type { Env } from '@profitily/shared';
import type { Response } from 'express';

import { ENV } from '../config/config.module.js';

import { verifyShopifyHmac } from './hmac.js';
import { parseShopDomain } from './shop-domain.js';
import { requireShopifyConfig } from './shopify-config.js';

/**
 * App URL root entrypoint. Shopify loads the configured App URL (`GET /`) with
 * `?shop=&hmac=&host=&timestamp=` at install (and on app open). This is the front door
 * that funnels into the single OAuth flow:
 *   - `shop` present → verify shop-format → HMAC (same fail-closed checks as the
 *     callback, reusing the shared helpers) → redirect into `/auth/shopify/install`
 *     (which mints the state nonce and redirects to Shopify authorize).
 *   - no `shop` → a neutral 200 landing (the bare App URL hit, no install context) —
 *     not a 404.
 *
 * It starts NO second OAuth path and holds no crypto of its own. (When an embedded
 * session exists — TASK-011 — an already-installed shop will branch to the embedded UI
 * here instead of re-running OAuth; for now every verified shop hit funnels to install,
 * which is idempotent.)
 */
@Controller()
export class RootController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  @Get('/')
  root(@Query() query: Record<string, string>, @Res() res: Response): void {
    if (!query.shop) {
      res.status(200).send('Profitily API');
      return;
    }
    const shopDomain = parseShopDomain(query.shop);
    if (!shopDomain) {
      res.status(400).send('Invalid shop');
      return;
    }
    const { apiSecret } = requireShopifyConfig(this.env);
    if (!verifyShopifyHmac(query, apiSecret)) {
      res.status(401).send('HMAC verification failed');
      return;
    }
    res.redirect(
      `/auth/shopify/install?shop=${encodeURIComponent(shopDomain)}`,
    );
  }
}
