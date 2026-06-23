// Shared ESLint flat-config preset for the Profitily monorepo.
// Includes eslint-plugin-security (mandatory security linting per docs/13).
import js from '@eslint/js';
import security from 'eslint-plugin-security';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/node_modules/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  security.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // Tenant-isolation hardening (sev-1, docs/13 §2/§7 · TASK-009): Prisma raw SQL
      // bypasses the tenant guard. Ban it repo-wide so an accidental unscoped raw
      // query can never ship. The selector matches both the call callee
      // (`db.$queryRawUnsafe(...)`) and the tagged-template tag (`db.$queryRaw`...``).
      // A sanctioned raw query uses the UNGUARDED client + a manual storeId predicate
      // and an audited disable:
      //   // eslint-disable-next-line no-restricted-syntax -- TENANT-RAW-OK: <reason + storeId predicate>
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[property.name=/^\\$(queryRaw|queryRawUnsafe|executeRaw|executeRawUnsafe)$/]",
          message:
            'Prisma raw SQL ($queryRaw/$queryRawUnsafe/$executeRaw/$executeRawUnsafe) bypasses the tenant guard (docs/13 §2/§7). Use scoped Prisma model operations. For a sanctioned raw query, use the unguarded client with a manual storeId predicate and disable this rule with a justification: // eslint-disable-next-line no-restricted-syntax -- TENANT-RAW-OK: <reason + storeId predicate>.',
        },
        {
          // The unguarded bootstrap client has NO tenant guard (docs/13 §2, TASK-009/010).
          // It is only sanctioned for new-tenant provisioning at Shopify install.
          selector: "CallExpression[callee.name='createUnscopedClient']",
          message:
            'createUnscopedClient() has NO tenant guard — it can read/write across tenants. Use the guarded createTenantClient(). If this truly is new-tenant provisioning before a tenant context exists, justify it: // eslint-disable-next-line no-restricted-syntax -- UNSCOPED-BOOTSTRAP-OK: <reason>.',
        },
      ],
    },
  },
);
