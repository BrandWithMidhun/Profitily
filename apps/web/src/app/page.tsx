import { ComingSoon } from '@/components/shell/coming-soon';
import { PageHeader } from '@/components/shell/page-header';

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Executive Dashboard"
        description="Your true profit at a glance — KPIs, profit waterfall, and trends."
      />
      <ComingSoon feature="The executive dashboard" />
    </>
  );
}
