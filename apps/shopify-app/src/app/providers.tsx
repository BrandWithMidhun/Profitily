'use client';

import { AppProvider } from '@shopify/polaris';
import en from '@shopify/polaris/locales/en.json';
import type { ReactNode } from 'react';

// Polaris components rely on AppProvider context (client-side). No App Bridge / host
// here — real embedding + session verification is TASK-010/011.
export function Providers({ children }: { children: ReactNode }) {
  return <AppProvider i18n={en}>{children}</AppProvider>;
}
