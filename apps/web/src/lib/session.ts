// STUB(TASK-010/011): replace with real Shopify OAuth/JWT session + real store list
export type StubSession = { user: { name: string; email: string } };
export type StubStore = { id: string; name: string; currency: string };

/** Placeholder session so layouts render before real auth exists. */
export function getStubSession(): StubSession {
  return { user: { name: 'Demo User', email: 'demo@profitily.test' } };
}

/** Static store list for the switcher until the real membership API lands. */
export function getStubStores(): StubStore[] {
  return [
    { id: 'store_demo', name: 'Demo Store', currency: 'USD' },
    { id: 'store_acme', name: 'Acme Apparel', currency: 'USD' },
    { id: 'store_globe', name: 'Globe Goods (UK)', currency: 'GBP' },
  ];
}
