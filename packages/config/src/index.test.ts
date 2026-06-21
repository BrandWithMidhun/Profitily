import { describe, expect, it } from 'vitest';

import { CONFIG_PACKAGE } from './index.js';

describe('@profitily/config', () => {
  it('exposes its package name', () => {
    expect(CONFIG_PACKAGE).toBe('@profitily/config');
  });
});
