import { Global, Module } from '@nestjs/common';
import { type Env, loadEnv } from '@profitily/shared';

/** Injection token for the validated, typed environment. */
export const ENV = Symbol('ENV');

/**
 * Validates the environment once at startup via @profitily/shared `loadEnv`
 * (fail-closed, secret-safe) and provides the typed `Env` app-wide.
 */
@Global()
@Module({
  providers: [{ provide: ENV, useFactory: (): Env => loadEnv() }],
  exports: [ENV],
})
export class ConfigModule {}
