'use client';

import { Toaster as Sonner } from 'sonner';

/** Global toast host (docs/11 §5 — shell toasts). Mounted once in the shell. */
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            'rounded-lg border border-border bg-card text-card-foreground shadow-md',
        },
      }}
    />
  );
}
