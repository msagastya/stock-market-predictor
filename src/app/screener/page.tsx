import StockScreener from '@/components/tools/StockScreener';
import { PageHero } from '@/components/layout/PageHero';

export default function ScreenerPage() {
  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Screener"
        title="Idea discovery should feel fast, selective, and intentional."
        description="Use a cleaner screening surface to search for opportunities, apply practical boundaries, and move the strongest ideas into deeper research."
        metrics={[
          { label: 'Engine', value: 'Search-Led' },
          { label: 'Focus', value: 'India + Global' },
          { label: 'Output', value: 'Research Candidates' },
        ]}
      />

      <StockScreener />
    </div>
  );
}
// force rebuild Sun May 10 12:13:02 IST 2026
