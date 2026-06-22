import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getStubSession } from '@/lib/session';

import './globals.css';

export const metadata: Metadata = {
  title: 'Profitily',
  description: 'Profitily portal',
};

// Minimal page frame only — the full app shell (left nav, store switcher, global
// date-range) is TASK-008. This just proves the app boots and renders the session.
export default function RootLayout({ children }: { children: ReactNode }) {
  const { user } = getStubSession();

  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <header className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
          <span className="font-semibold">Profitily</span>
          <span data-testid="stub-user" className="text-sm text-gray-600">
            {user.name}
          </span>
        </header>
        <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
