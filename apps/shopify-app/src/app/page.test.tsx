import { AppProvider } from '@shopify/polaris';
import en from '@shopify/polaris/locales/en.json';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import AppHome from './page';

describe('Shopify app-home', () => {
  it('renders the Polaris landing with sync status and the portal CTA', () => {
    render(
      <AppProvider i18n={en}>
        <AppHome />
      </AppProvider>,
    );
    expect(
      screen.getByRole('heading', { name: /Welcome/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Sync status')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Open Profitily Portal/ }),
    ).toBeInTheDocument();
  });
});
