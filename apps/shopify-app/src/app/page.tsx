'use client';

import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  InlineGrid,
  InlineStack,
  Page,
  ProgressBar,
  Text,
} from '@shopify/polaris';

import { getStubSession } from '@/lib/session';

// S2 app-home (docs/11 §4) — real Polaris landing with STATIC data: sync-status card
// (last sync + per-source lag), plan badge, setup-progress, and the "Open Profitily
// Portal" CTA. Real SyncState/Subscription wiring lands at TASK-023/012.
const SYNC_SOURCES = [
  { source: 'Shopify orders', lag: 'up to date' },
  { source: 'Shopify products', lag: 'up to date' },
  { source: 'Ad platforms', lag: 'not connected' },
];

const PORTAL_URL = 'http://localhost:3000';

export default function AppHome() {
  const { user } = getStubSession();

  return (
    <Page title="Profitily">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">
                Welcome, {user.name}
              </Text>
              <Badge tone="info">Free plan</Badge>
            </InlineStack>
            <Text as="p" tone="subdued">
              Profitily is computing your true profit across orders, products, and
              campaigns.
            </Text>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h3" variant="headingSm">
                Sync status
              </Text>
              <Badge tone="success">Synced</Badge>
            </InlineStack>
            <Text as="p" tone="subdued">
              Last sync: just now
            </Text>
            <BlockStack gap="200">
              {SYNC_SOURCES.map(({ source, lag }) => (
                <InlineStack key={source} align="space-between">
                  <Text as="span">{source}</Text>
                  <Text as="span" tone="subdued">
                    {lag}
                  </Text>
                </InlineStack>
              ))}
            </BlockStack>
          </BlockStack>
        </Card>

        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                Finish setup
              </Text>
              <ProgressBar progress={60} size="small" tone="primary" />
              <Text as="p" tone="subdued">
                3 of 5 steps complete — add product costs to unlock accurate profit.
              </Text>
              <Box>
                <Button url="/setup">Continue setup</Button>
              </Box>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                Open the portal
              </Text>
              <Text as="p" tone="subdued">
                Dashboards, cost management, shipping rules, and reports live in the
                full Profitily portal.
              </Text>
              <Box>
                <Button variant="primary" url={PORTAL_URL}>
                  Open Profitily Portal
                </Button>
              </Box>
            </BlockStack>
          </Card>
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}
