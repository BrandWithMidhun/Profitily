import { ComingSoon } from '@/components/shell/coming-soon';
import { PageHeader } from '@/components/shell/page-header';

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader title="Integrations" description="Connect Shopify, couriers, and ad platforms." />
      <ComingSoon feature="Integrations" />
    </>
  );
}
