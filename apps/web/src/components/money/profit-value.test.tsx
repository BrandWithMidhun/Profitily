import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Delta, ProfitValue } from './profit-value';

// Bind-down 1: profit/loss must be conveyed by SIGN + LABEL + colour, never colour
// alone. These tests assert sign and label are present in the DOM — independent of any
// colour class — so the a11y contract every future money column inherits is airtight.
describe('ProfitValue', () => {
  it('shows a + sign and a "profit" label for positive values', () => {
    render(<ProfitValue minorUnits={123456n} currency="USD" />);
    expect(screen.getByText(/\+\$1,234\.56/)).toBeInTheDocument();
    expect(screen.getByText(/profit/)).toBeInTheDocument();
  });

  it('shows a − sign and a "loss" label for negative values', () => {
    render(<ProfitValue minorUnits={-5000n} currency="USD" />);
    expect(screen.getByText(/−\$50\.00/)).toBeInTheDocument();
    expect(screen.getByText(/loss/)).toBeInTheDocument();
  });

  it('labels zero as break-even', () => {
    render(<ProfitValue minorUnits={0n} currency="USD" />);
    expect(screen.getByText(/break-even/)).toBeInTheDocument();
  });

  it('uses tabular figures for column alignment', () => {
    const { container } = render(
      <ProfitValue minorUnits={100n} currency="USD" />,
    );
    expect(container.firstChild).toHaveClass('tabular-money');
  });
});

describe('Delta', () => {
  it('labels a positive change as an increase with a sign', () => {
    render(<Delta minorUnits={2500n} currency="USD" />);
    expect(screen.getByText(/\+\$25\.00/)).toBeInTheDocument();
    expect(screen.getByText(/increase/)).toBeInTheDocument();
  });

  it('labels a negative change as a decrease with a sign', () => {
    render(<Delta minorUnits={-2500n} currency="USD" />);
    expect(screen.getByText(/−\$25\.00/)).toBeInTheDocument();
    expect(screen.getByText(/decrease/)).toBeInTheDocument();
  });
});
