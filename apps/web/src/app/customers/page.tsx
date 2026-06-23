import { ComingSoon } from '@/components/shell/coming-soon';
import { PageHeader } from '@/components/shell/page-header';

export default function CustomersPage() {
  return (
    <>
      <PageHeader title="Customers" description="LTV, total profit, and purchase frequency." />
      <ComingSoon feature="Customer analytics" />
    </>
  );
}
