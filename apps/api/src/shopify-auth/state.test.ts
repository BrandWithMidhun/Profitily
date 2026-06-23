import { describe, expect, it } from 'vitest';

import { generateState, statesMatch } from './state.js';

describe('OAuth state', () => {
  it('generates distinct nonces', () => {
    expect(generateState()).not.toBe(generateState());
  });

  it('matches identical states', () => {
    const s = generateState();
    expect(statesMatch(s, s)).toBe(true);
  });

  it('rejects mismatched states', () => {
    expect(statesMatch(generateState(), generateState())).toBe(false);
  });

  it('rejects missing states (fail closed)', () => {
    expect(statesMatch(undefined, 'x')).toBe(false);
    expect(statesMatch('x', undefined)).toBe(false);
    expect(statesMatch(undefined, undefined)).toBe(false);
  });
});
