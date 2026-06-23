import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AccountMenu } from './account-menu';

describe('AccountMenu', () => {
  it('opens to reveal the stub user and actions', async () => {
    const user = userEvent.setup();
    render(<AccountMenu />);

    await user.click(screen.getByRole('button', { name: 'Account menu' }));

    expect(await screen.findByText('demo@profitily.test')).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /Sign out/ }),
    ).toBeInTheDocument();
  });
});
