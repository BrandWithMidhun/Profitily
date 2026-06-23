import type { Env } from '@profitily/shared';

export interface ShopifyConfig {
  apiKey: string;
  apiSecret: string;
  scopes: string;
  /** Base URL the redirect_uri is built from (the app's public URL). */
  base: string;
}

/**
 * Resolve the Shopify OAuth config, failing closed if the app isn't configured. Shared
 * by the App-URL root entrypoint and the install/callback controller so HMAC/redirect
 * logic uses one source.
 */
export function requireShopifyConfig(env: Env): ShopifyConfig {
  const apiKey = env.SHOPIFY_API_KEY;
  const apiSecret = env.SHOPIFY_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error(
      'Shopify OAuth is not configured (SHOPIFY_API_KEY / SHOPIFY_API_SECRET).',
    );
  }
  return {
    apiKey,
    apiSecret,
    scopes: env.SHOPIFY_SCOPES,
    base: env.SHOPIFY_APP_URL ?? env.API_BASE_URL,
  };
}
