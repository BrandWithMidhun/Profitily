import { shopResponseSchema, tokenExchangeResponseSchema } from './schemas.js';

export interface ShopInfo {
  currency: string;
  country?: string | undefined;
  email?: string | undefined;
  shopOwner?: string | undefined;
}

/** The Shopify OAuth calls, behind an interface so tests stub them (no live Shopify in CI). */
export interface ShopifyOAuthClient {
  /** Exchange an auth code for an offline access token. */
  exchangeCode(shop: string, code: string): Promise<string>;
  /** Read the shop's base currency + owner identity. */
  fetchShop(shop: string, accessToken: string): Promise<ShopInfo>;
}

/** DI token. */
export const SHOPIFY_OAUTH_CLIENT = Symbol('SHOPIFY_OAUTH_CLIENT');

export interface ShopifyClientConfig {
  apiKey: string;
  apiSecret: string;
  apiVersion: string;
}

/** Real implementation against the Shopify Admin API. Responses are zod-validated. */
export class HttpShopifyOAuthClient implements ShopifyOAuthClient {
  constructor(private readonly cfg: ShopifyClientConfig) {}

  async exchangeCode(shop: string, code: string): Promise<string> {
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: this.cfg.apiKey,
        client_secret: this.cfg.apiSecret,
        code,
      }),
    });
    if (!res.ok) {
      throw new Error(`Shopify token exchange failed (HTTP ${res.status})`);
    }
    const parsed = tokenExchangeResponseSchema.parse(await res.json());
    return parsed.access_token;
  }

  async fetchShop(shop: string, accessToken: string): Promise<ShopInfo> {
    const res = await fetch(
      `https://${shop}/admin/api/${this.cfg.apiVersion}/shop.json`,
      { headers: { 'X-Shopify-Access-Token': accessToken } },
    );
    if (!res.ok) {
      throw new Error(`Shopify shop fetch failed (HTTP ${res.status})`);
    }
    const { shop: s } = shopResponseSchema.parse(await res.json());
    return {
      currency: s.currency,
      country: s.country_code,
      email: s.email,
      shopOwner: s.shop_owner,
    };
  }
}
