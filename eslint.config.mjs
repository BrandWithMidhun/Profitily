// Root ESLint flat config — consumes the shared preset from @profitily/config.
// Flat config is resolved by walking up from each package, so this single root
// config governs the whole workspace.
export { default } from '@profitily/config/eslint';
