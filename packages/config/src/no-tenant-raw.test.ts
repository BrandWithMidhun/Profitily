/**
 * Proves the shared ESLint preset bans Prisma raw SQL (the tenant-guard raw boundary,
 * sev-1 · TASK-009 · docs/13 §2/§7). Verifies both that the rule is present in the
 * preset and that it actually flags every banned verb while leaving scoped model
 * operations alone.
 */
import { type Linter, Linter as LinterClass } from 'eslint';
import { describe, expect, it } from 'vitest';

import preset from '../eslint.preset.mjs';

// Pull the no-restricted-syntax config out of the preset so we test what actually ships.
function presetRawRule(): Linter.RuleEntry {
  for (const block of preset) {
    const rule = block.rules?.['no-restricted-syntax'];
    if (rule) return rule;
  }
  throw new Error('no-restricted-syntax not found in the shared preset');
}

const linter = new LinterClass();

function lint(code: string): Linter.LintMessage[] {
  return linter.verify(code, {
    rules: { 'no-restricted-syntax': presetRawRule() },
  });
}

describe('shared ESLint preset — Prisma raw SQL ban', () => {
  it('the preset configures no-restricted-syntax for the raw verbs', () => {
    const rule = JSON.stringify(presetRawRule());
    for (const verb of [
      'queryRaw',
      'queryRawUnsafe',
      'executeRaw',
      'executeRawUnsafe',
    ]) {
      expect(rule).toContain(verb);
    }
  });

  it.each([
    'db.$queryRaw`SELECT 1`;',
    'db.$queryRawUnsafe("SELECT 1");',
    'db.$executeRaw`DELETE FROM "Membership"`;',
    'db.$executeRawUnsafe("DELETE FROM x");',
  ])('flags %s', (code) => {
    const messages = lint(code);
    expect(messages.some((m) => m.ruleId === 'no-restricted-syntax')).toBe(true);
  });

  it('does NOT flag scoped model operations', () => {
    const messages = lint('db.membership.findMany({ where: { role: "OWNER" } });');
    expect(messages.filter((m) => m.ruleId === 'no-restricted-syntax')).toHaveLength(
      0,
    );
  });

  it('flags an unguarded createUnscopedClient() call', () => {
    const messages = lint('const db = createUnscopedClient();');
    expect(messages.some((m) => m.ruleId === 'no-restricted-syntax')).toBe(true);
  });

  it('does NOT flag the guarded createTenantClient()', () => {
    const messages = lint('const db = createTenantClient();');
    expect(messages.filter((m) => m.ruleId === 'no-restricted-syntax')).toHaveLength(
      0,
    );
  });
});
