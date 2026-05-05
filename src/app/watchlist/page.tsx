'use client';

import { useRouter } from 'next/navigation';
import { PageHero } from '@/components/layout/PageHero';
import Watchlist from '@/components/portfolio/Watchlist';

export default function WatchlistPage() {
  const router = useRouter();

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Watchlist"
        title="A focused monitor for symbols you actually care about."
        description="Keep your priority names in one place, review quotes at a glance, and jump straight from monitoring into full research."
        metrics={[
          { label: 'Use Case', value: 'Track + Route' },
          { label: 'Coverage', value: 'Indices, Stocks' },
          { label: 'Action', value: 'Open In Research' },
        ]}
      />

      <Watchlist
        onSelectStock={(symbol, name) => {
          router.push(`/research/${encodeURIComponent(symbol)}?name=${encodeURIComponent(name)}`);
        }}
      />
    </div>
  );
}
