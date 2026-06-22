// Stryker mutation testing for packages/core (the correctness boundary).
// Non-breaking now (core is a harness probe); the >=85% break gate is set at TASK-050
// when the real engine lands. Runs nightly/local, never in the PR gate.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'pnpm',
  testRunner: 'vitest',
  // Explicit plugin load — pnpm's nested node_modules breaks Stryker's default
  // "@stryker-mutator/*" auto-discovery glob.
  plugins: ['@stryker-mutator/vitest-runner'],
  mutate: ['src/**/*.ts', '!src/**/*.test.ts'],
  reporters: ['progress', 'clear-text'],
  coverageAnalysis: 'perTest',
  thresholds: { high: 85, low: 60, break: null },
};
