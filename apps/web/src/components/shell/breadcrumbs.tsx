'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NAV_ITEMS } from '@/lib/nav';

function labelFor(segment: string): string {
  const match = NAV_ITEMS.find((item) => item.href === `/${segment}`);
  if (match) return match.label;
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex items-center gap-1.5">
        <li>
          <Link href="/" className="hover:text-foreground">
            Dashboard
          </Link>
        </li>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join('/')}`;
          const isLast = index === segments.length - 1;
          return (
            <li key={href} className="flex items-center gap-1.5">
              <span aria-hidden="true">/</span>
              {isLast ? (
                <span className="font-medium text-foreground" aria-current="page">
                  {labelFor(segment)}
                </span>
              ) : (
                <Link href={href} className="hover:text-foreground">
                  {labelFor(segment)}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
