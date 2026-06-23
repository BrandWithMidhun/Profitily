import { ComingSoon } from '@/components/shell/coming-soon';
import { PageHeader } from '@/components/shell/page-header';
export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" description="Daily, weekly, and monthly reports." />
      <ComingSoon feature="Reports" />
    </>
  );
}
