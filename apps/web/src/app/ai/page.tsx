import { ComingSoon } from '@/components/shell/coming-soon';
import { PageHeader } from '@/components/shell/page-header';

export default function AiPage() {
  return (
    <>
      <PageHeader title="AI" description="Ask your AI CFO about profit, costs, and trends." />
      <ComingSoon feature="The AI agent hub" />
    </>
  );
}
