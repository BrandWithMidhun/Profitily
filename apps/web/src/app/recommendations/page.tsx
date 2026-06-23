import { ComingSoon } from '@/components/shell/coming-soon';
import { PageHeader } from '@/components/shell/page-header';

export default function RecommendationsPage() {
  return (
    <>
      <PageHeader title="Recommendations" description="Proactive actions with expected profit impact." />
      <ComingSoon feature="Recommendations" />
    </>
  );
}
