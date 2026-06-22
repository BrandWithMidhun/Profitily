// STUB(TASK-010/011): replace with real Shopify OAuth/JWT session
export type StubSession = { user: { name: string; email: string } };

/** Placeholder session so layouts render before real auth exists. */
export function getStubSession(): StubSession {
  return { user: { name: 'Demo User', email: 'demo@profitily.test' } };
}
