// HARNESS PROBE — not engine code. Real profit engine lands at TASK-050 (docs/06). Delete/replace then.
//
// packages/core is the M08 correctness boundary. This single trivial pure function
// exists ONLY so the test harness (fast-check property tests, Stryker mutation,
// 100% coverage gate) has something to wire against. It is NOT domain logic.
export function __harnessProbe(parts: readonly number[]): number {
  return parts.reduce((sum, part) => sum + part, 0);
}
