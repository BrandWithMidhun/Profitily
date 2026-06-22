'use client';

import {
  Badge,
  BlockStack,
  Button,
  Card,
  Page,
  Text,
} from '@shopify/polaris';

import { getStubSession } from '@/lib/session';

// S2 app-home (docs/11 §4) — minimal STATIC skeleton: plan badge, a sync-status
// placeholder, and the "Open Profitily Portal" CTA. Real SyncState/Subscription
// data wiring is a later task (TASK-023/012).
export default function AppHome() {
  const { user } = getStubSession();

  return (
    <Page title="Profitily">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              Welcome, {user.name}
            </Text>
            <Badge tone="info">Free plan</Badge>
            <Text as="p" tone="subdued">
              Sync status: idle (placeholder)
            </Text>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="200">
            <Text as="p">
              Open the full Profitily portal for dashboards, costs, and reports.
            </Text>
            <Button variant="primary" url="http://localhost:3000">
              Open Profitily Portal
            </Button>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
