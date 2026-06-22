import fc from 'fast-check';
import { describe, it } from 'vitest';

import { __harnessProbe } from './index.js';

// fast-check wiring proof (real engine invariants — splits sum to the whole,
// roll-up reconciliation, etc. — arrive with the engine at TASK-050/051).
describe('__harnessProbe property', () => {
  it('is order-independent (commutative fold)', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -1e6, max: 1e6 })), (parts) => {
        const reversed = [...parts].reverse();
        return __harnessProbe(parts) === __harnessProbe(reversed);
      }),
    );
  });
});
