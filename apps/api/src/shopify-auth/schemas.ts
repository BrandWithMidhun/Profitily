import { z } from 'zod';

/** Shopify OAuth callback query params (zod-validated boundary, docs/13 §7). */
export const callbackQuerySchema = z.object({
  shop: z.string(),
  code: z.string().min(1),
  state: z.string().min(1),
  hmac: z.string().min(1),
  host: z.string().optional(),
  timestamp: z.string().optional(),
});

/** Shopify token-exchange response. */
export const tokenExchangeResponseSchema = z.object({
  access_token: z.string().min(1),
  scope: z.string().optional(),
});

/** Shopify `GET /admin/api/{version}/shop.json` response (fields we read). */
export const shopResponseSchema = z.object({
  shop: z.object({
    currency: z.string().min(1),
    country_code: z.string().optional(),
    email: z.string().optional(),
    shop_owner: z.string().optional(),
  }),
});

export type TokenExchangeResponse = z.infer<typeof tokenExchangeResponseSchema>;
export type ShopResponse = z.infer<typeof shopResponseSchema>;
