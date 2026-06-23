import { ComingSoon } from '@/components/shell/coming-soon';
import { PageHeader } from '@/components/shell/page-header';

export default function CostsPage() {
  return (
    <>
      <PageHeader title="Costs" description="Product costs, packaging, fees, and operating expenses." />
      <ComingSoon feature="Cost management" />
    </>
  );
}
