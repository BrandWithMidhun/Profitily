import 'vitest';

// Type the vitest-axe matcher we extend in vitest.setup.ts.
declare module 'vitest' {
  interface Assertion<T = unknown> {
    toHaveNoViolations(): T;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): unknown;
  }
}
