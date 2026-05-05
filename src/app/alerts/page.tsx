import AlertsManager from '@/components/tools/AlertsManager';
import { PageHero } from '@/components/layout/PageHero';

export default function AlertsPage() {
  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Alerts"
        title="Turn watch levels into a clean trigger desk."
        description="Manage threshold alerts with a tighter operational layout today, leaving room for future multi-condition and portfolio-risk automation."
        metrics={[
          { label: 'Type', value: 'Price Trigger' },
          { label: 'Mode', value: 'Local Tracking' },
          { label: 'Next Step', value: 'Multi-Condition Rules' },
        ]}
      />

      <AlertsManager />
    </div>
  );
}
