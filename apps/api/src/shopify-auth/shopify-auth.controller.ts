import { Controller, Get, Inject, Query, Req, Res } from '@nestjs/common';
import type { Env } from '@profitily/shared';
import type { Request, Response } from 'express';

import { ENV } from '../config/config.module.js';

import { verifyShopifyHmac } from './hmac.js';
import { callbackQuerySchema } from './schemas.js';
import { parseShopDomain } from './shop-domain.js';
import { ShopifyInstallService } from './shopify-install.service.js';
import {
  SHOPIFY_OAUTH_CLIENT,
  type ShopifyOAuthClient,
} from './shopify-oauth.client.js';
import { generateState, statesMatch } from './state.js';

const STATE_COOKIE = 'shopify_oauth_state';

@Controller('auth/shopify')
export class ShopifyAuthController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(SHOPIFY_OAUTH_CLIENT) private readonly shopify: ShopifyOAuthClient,
    private readonly installer: ShopifyInstallService,
  ) {}

  private requireConfig(): {
    apiKey: string;
    apiSecret: string;
    scopes: string;
    base: string;
  } {
    const apiKey = this.env.SHOPIFY_API_KEY;
    const apiSecret = this.env.SHOPIFY_API_SECRET;
    if (!apiKey || !apiSecret) {
      throw new Error(
        'Shopify OAuth is not configured (SHOPIFY_API_KEY / SHOPIFY_API_SECRET).',
      );
    }
    return {
      apiKey,
      apiSecret,
      scopes: this.env.SHOPIFY_SCOPES,
      base: this.env.SHOPIFY_APP_URL ?? this.env.API_BASE_URL,
    };
  }

  /** Begin install: validate shop, set the signed state cookie, redirect to Shopify. */
  @Get('install')
  install(@Query('shop') shop: string | undefined, @Res() res: Response): void {
    const shopDomain = parseShopDomain(shop);
    if (!shopDomain) {
      res.status(400).send('Invalid shop parameter');
      return;
    }
    const { apiKey, scopes, base } = this.requireConfig();
    const state = generateState();
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.env.NODE_ENV === 'production',
      signed: true,
      maxAge: 10 * 60 * 1000,
      path: '/auth/shopify',
    });
    const redirectUri = `${base}/auth/shopify/callback`;
    const url =
      `https://${shopDomain}/admin/oauth/authorize` +
      `?client_id=${encodeURIComponent(apiKey)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}`;
    res.redirect(url);
  }

  /**
   * OAuth callback. Verify shop-format → HMAC → state IN THAT ORDER, fail-closed: no
   * token exchange or DB write happens on any verification failure (docs/13 §3/§8).
   */
  @Get('callback')
  async callback(
    @Query() query: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { apiSecret, base } = this.requireConfig();

    // (a) shop format
    const shopDomain = parseShopDomain(query.shop);
    if (!shopDomain) {
      res.status(400).send('Invalid shop');
      return;
    }
    // (b) HMAC
    if (!verifyShopifyHmac(query, apiSecret)) {
      res.status(401).send('HMAC verification failed');
      return;
    }
    // (c) state vs the signed cookie nonce
    const signed = (req.signedCookies ?? {}) as Record<string, string>;
    if (!statesMatch(signed[STATE_COOKIE], query.state)) {
      res.status(403).send('Invalid OAuth state');
      return;
    }
    res.clearCookie(STATE_COOKIE, { path: '/auth/shopify' });

    const parsed = callbackQuerySchema.safeParse(query);
    if (!parsed.success) {
      res.status(400).send('Invalid callback parameters');
      return;
    }

    // All checks passed — now (and only now) talk to Shopify and persist.
    const accessToken = await this.shopify.exchangeCode(
      shopDomain,
      parsed.data.code,
    );
    const shopInfo = await this.shopify.fetchShop(shopDomain, accessToken);
    await this.installer.install({
      shopDomain,
      accessToken,
      baseCurrency: shopInfo.currency,
      country: shopInfo.country,
      ownerEmail: shopInfo.email,
    });

    res.redirect(`${base}/?shop=${encodeURIComponent(shopDomain)}`);
  }
}
