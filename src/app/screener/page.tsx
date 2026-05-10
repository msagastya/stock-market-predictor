'use client';

import StockScreener from '@/components/tools/StockScreener';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function ScreenerPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Screener</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em' }}>Stock Discovery</h1>
      </div>
      <ErrorBoundary>
        <StockScreener />
      </ErrorBoundary>
    </div>
  );
}
