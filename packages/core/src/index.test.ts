import { describe, expect, it } from 'vitest';

import { __harnessProbe } from './index.js';

describe('__harnessProbe (harness probe — not engine code)', () => {
  it('sums the parts', () => {
    expect(__harnessProbe([1, 2, 3])).toBe(6);
  });

  it('returns 0 for no parts', () => {
    expect(__harnessProbe([])).toBe(0);
  });
});
