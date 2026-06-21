/**
 * Shared configuration presets for the Profitily monorepo.
 *
 * The presets themselves are exposed as package subpath exports:
 *   - `@profitily/config/eslint`            (ESLint flat config)
 *   - `@profitily/config/prettier`          (Prettier config)
 *   - `@profitily/config/vitest`            (Vitest config)
 *   - `@profitily/config/tsconfig.base.json` (TypeScript base config)
 *
 * This module is the typed entry point so the package has compilable source
 * (and a home for any future shared config helpers).
 */
export const CONFIG_PACKAGE = '@profitily/config' as const;
