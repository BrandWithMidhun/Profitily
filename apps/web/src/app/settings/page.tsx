import { ComingSoon } from '@/components/shell/coming-soon';
import { PageHeader } from '@/components/shell/page-header';

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Store currency, team, billing, and account." />
      <ComingSoon feature="Settings" />
    </>
  );
}
