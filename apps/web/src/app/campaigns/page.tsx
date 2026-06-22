import { ComingSoon } from '@/components/shell/coming-soon';
import { PageHeader } from '@/components/shell/page-header';

export default function CampaignsPage() {
  return (
    <>
      <PageHeader title="Campaigns" description="Spend, revenue, profit, and ROAS by campaign." />
      <ComingSoon feature="Campaign profitability" />
    </>
  );
}
