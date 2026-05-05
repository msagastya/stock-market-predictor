import Portfolio from '@/components/portfolio/Portfolio';
import { PageHero } from '@/components/layout/PageHero';

export default function PortfolioPage() {
  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Portfolio"
        title="Positions, cost basis, and live exposure in one clear workspace."
        description="Track open holdings with a cleaner operator view, add symbols through search-backed entry, and refresh live quote context only when needed."
        metrics={[
          { label: 'View', value: 'Holdings Ledger' },
          { label: 'Mode', value: 'Manual + Live Quotes' },
          { label: 'Workflow', value: 'Add, Review, Reprice' },
        ]}
      />

      <Portfolio />
    </div>
  );
}
