import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@shopify/polaris/build/esm/styles.css';

import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Profitily — Shopify',
  description: 'Profitily embedded Shopify app',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
