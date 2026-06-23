import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: LucideIcon;
  /** Optional call-to-action (e.g. a Button). */
  cta?: ReactNode;
  className?: string;
}

/** The reusable `empty` state (docs/11 §3) — message + helpful CTA, not a blank page. */
export function EmptyState({
  title,
  message,
  icon: Icon = Inbox,
  cta,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center',
        className,
      )}
    >
      <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}
      </div>
      {cta ? <div className="mt-2">{cta}</div> : null}
    </div>
  );
}
