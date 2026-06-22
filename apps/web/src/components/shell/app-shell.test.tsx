import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';

import { AppShell } from './app-shell';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={typeof href === 'string' ? href : '#'} {...props}>
      {children}
    </a>
  ),
}));

describe('AppShell a11y', () => {
  it('renders the shell with no axe violations', async () => {
    const { container } = render(
      <AppShell>
        <h1>Executive Dashboard</h1>
        <p>Placeholder content.</p>
      </AppShell>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
