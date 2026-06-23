'use client';

import { Menu } from 'lucide-react';

import { AccountMenu } from '@/components/shell/account-menu';
import { Breadcrumbs } from '@/components/shell/breadcrumbs';
import { DateRange } from '@/components/shell/date-range';
import { StoreSwitcher } from '@/components/shell/store-switcher';
import { Button } from '@/components/ui/button';

export function TopBar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur lg:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation"
        onClick={onOpenMobileNav}
      >
        <Menu className="size-5" />
      </Button>

      <div className="hidden md:block">
        <Breadcrumbs />
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="hidden sm:block">
          <StoreSwitcher />
        </div>
        <div className="hidden sm:block">
          <DateRange />
        </div>
        <AccountMenu />
      </div>
    </header>
  );
}
