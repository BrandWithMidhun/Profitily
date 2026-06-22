import { ComingSoon } from '@/components/shell/coming-soon';
import { PageHeader } from '@/components/shell/page-header';

export default function AlertsPage() {
  return (
    <>
      <PageHeader title="Alerts" description="Threshold rules and your alert inbox." />
      <ComingSoon feature="Alerts" />
    </>
  );
}
