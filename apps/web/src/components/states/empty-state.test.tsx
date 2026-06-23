import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from '@/components/ui/button';

import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('renders title, message, and CTA', () => {
    render(
      <EmptyState
        title="No costs yet"
        message="Add your first cost to see profit."
        cta={<Button>Add cost</Button>}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'No costs yet' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Add your first cost to see profit.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add cost' })).toBeInTheDocument();
  });
});
