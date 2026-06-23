import * as React from 'react';

import { cn } from '@/lib/utils';

/** Loading placeholder — the `loading` state primitive every data view reuses. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}
