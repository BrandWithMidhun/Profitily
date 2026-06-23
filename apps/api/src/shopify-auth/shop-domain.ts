import { z } from 'zod';

/** A Shopify shop domain: `<store>.myshopify.com`. */
export const shopDomainSchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i,
    'must be a *.myshopify.com domain',
  );

export function parseShopDomain(shop: unknown): string | null {
  const result = shopDomainSchema.safeParse(shop);
  return result.success ? result.data.toLowerCase() : null;
}
