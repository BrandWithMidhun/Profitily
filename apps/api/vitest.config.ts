// Vitest config for @profitily/api — consumes the shared preset and adds SWC so
// NestJS decorators + emitted decorator metadata work under Vitest (esbuild alone
// does not emit decorator metadata, which Nest DI requires).
import swc from 'unplugin-swc';
import preset from '@profitily/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  preset,
  defineConfig({
    plugins: [
      swc.vite({
        module: { type: 'es6' },
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          target: 'es2022',
          keepClassNames: true,
        },
      }),
    ],
    test: {
      setupFiles: ['./vitest.setup.ts'],
    },
  }),
);
