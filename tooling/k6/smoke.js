import { check, sleep } from 'k6';

// Trivial k6 wiring proof — confirms the load runner executes. Real load scenarios
// (dashboard read API p95 < 2s on a 50k-order seed, ingestion throughput, AI under
// concurrency) arrive at TASK-060/081 (docs/08 §2.10).
export const options = { vus: 1, iterations: 1 };

export default function () {
  check(true, { 'k6 harness runs': (ok) => ok === true });
  sleep(0.1);
}
