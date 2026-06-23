import { Module } from '@nestjs/common';
import type { Env } from '@profitily/shared';

import { ENV } from '../config/config.module.js';

import { BootstrapPrismaService } from './bootstrap-prisma.service.js';
import { RootController } from './root.controller.js';
import { ShopifyAuthController } from './shopify-auth.controller.js';
import { ShopifyInstallService } from './shopify-install.service.js';
import {
  HttpShopifyOAuthClient,
  SHOPIFY_OAUTH_CLIENT,
} from './shopify-oauth.client.js';
import { StoreEventsService } from './store-events.service.js';

@Module({
  controllers: [RootController, ShopifyAuthController],
  providers: [
    BootstrapPrismaService,
    StoreEventsService,
    ShopifyInstallService,
    {
      provide: SHOPIFY_OAUTH_CLIENT,
      inject: [ENV],
      useFactory: (env: Env) =>
        new HttpShopifyOAuthClient({
          apiKey: env.SHOPIFY_API_KEY ?? '',
          apiSecret: env.SHOPIFY_API_SECRET ?? '',
          apiVersion: env.SHOPIFY_API_VERSION,
        }),
    },
  ],
})
export class ShopifyAuthModule {}
