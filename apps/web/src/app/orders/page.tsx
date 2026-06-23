import { ComingSoon } from '@/components/shell/coming-soon';
import { PageHeader } from '@/components/shell/page-header';

export default function OrdersPage() {
  return (
    <>
      <PageHeader title="Orders" description="Revenue, cost, and net profit per order." />
      <ComingSoon feature="Order profitability" />
    </>
  );
}
