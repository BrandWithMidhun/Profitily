import { ComingSoon } from '@/components/shell/coming-soon';
import { PageHeader } from '@/components/shell/page-header';

export default function ShippingPage() {
  return (
    <>
      <PageHeader title="Shipping" description="Shipping rules and courier integrations." />
      <ComingSoon feature="Shipping rules" />
    </>
  );
}
