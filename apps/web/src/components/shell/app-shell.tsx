'use client';

import { LineChart } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { SidebarNav } from '@/components/shell/sidebar-nav';
import { TopBar } from '@/components/shell/top-bar';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Toaster } from '@/components/ui/sonner';

function Brand() {
  return (
    <div className="flex items-center gap-2 px-3 py-4">
      <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <LineChart className="size-5" aria-hidden="true" />
      </span>
      <span className="text-base font-semibold">Profitily</span>
    </div>
  );
}

/** The portal frame every route renders inside (docs/11 §5 P0). */
export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <SidebarNav />
        </div>
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="lg:hidden">
          <SheetTitle className="px-3 text-base font-semibold">
            Profitily
          </SheetTitle>
          <div className="mt-2 overflow-y-auto">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMobileNav={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>

      <Toaster />
    </div>
  );
}
