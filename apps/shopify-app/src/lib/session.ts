// STUB(TASK-010/011): replace with real Shopify OAuth/JWT session
export type StubSession = { user: { name: string; email: string } };

/** Placeholder session so the app-home renders before real Shopify auth exists. */
export function getStubSession(): StubSession {
  return { user: { name: 'Demo Merchant', email: 'merchant@demo-store.test' } };
}
