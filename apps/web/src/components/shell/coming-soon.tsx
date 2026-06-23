import { Clock } from 'lucide-react';

import { EmptyState } from '@/components/states/empty-state';

/**
 * Thin placeholder for a nav route whose page/module hasn't been built (TASK-008
 * bind-down 3). Real content arrives with that section's task — no data, no structure.
 */
export function ComingSoon({ feature }: { feature: string }) {
  return (
    <EmptyState
      icon={Clock}
      title={`${feature} is coming soon`}
      message="This section lights up once its data and module land."
    />
  );
}
