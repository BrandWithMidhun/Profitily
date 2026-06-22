import { ComingSoon } from '@/components/shell/coming-soon';
import { PageHeader } from '@/components/shell/page-header';

export default function ProductsPage() {
  return (
    <>
      <PageHeader title="Products" description="Profit, margin, and units by product." />
      <ComingSoon feature="Product profit" />
    </>
  );
}
