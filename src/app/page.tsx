'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MarketOverview } from '@/features/market/components/MarketOverview';
import PredictiveMovers from '@/components/PredictiveMovers';

const QUICK_LINKS = [
  { symbol: '^NSEI', name: 'Nifty 50' },
  { symbol: '^NSEBANK', name: 'Bank Nifty' },
  { symbol: '^BSESN', name: 'Sensex' },
  { symbol: 'RELIANCE.NS', name: 'Reliance' },
  { symbol: 'TCS.NS', name: 'TCS' },
  { symbol: 'INFY.NS', name: 'Infosys' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
  { symbol: 'ICICIBANK.NS', name: 'ICICI Bank' },
];

export default function Home() {
  const router = useRouter();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Dashboard
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Market Overview
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/zerodha" className="btn btn-primary btn-sm">Zerodha</Link>
          <Link href="/screener" className="btn btn-secondary btn-sm">Screener</Link>
        </div>
      </div>

      {/* Quick access */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {QUICK_LINKS.map((item) => (
          <button
            key={item.symbol}
            onClick={() => router.push(`/research/${encodeURIComponent(item.symbol)}?name=${encodeURIComponent(item.name)}`)}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--text2)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'all 0.1s',
              fontFamily: 'DM Sans, sans-serif',
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--text)'; (e.target as HTMLElement).style.borderColor = 'var(--border2)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text2)'; (e.target as HTMLElement).style.borderColor = 'var(--border)'; }}
          >
            {item.name}
          </button>
        ))}
      </div>

      {/* Market overview */}
      <MarketOverview
        onSelectStock={(symbol, name) => router.push(`/research/${encodeURIComponent(symbol)}?name=${encodeURIComponent(name)}`)}
      />

      {/* Predictive movers */}
      <PredictiveMovers />

      {/* Bottom cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { title: 'Research', desc: 'Deep-dive into any symbol with charts, technicals, and AI analysis.', href: '/research/%5ENSEI?name=Nifty%2050', cta: 'Open →' },
          { title: 'Watchlist', desc: 'Track your favourite stocks and jump straight into research.', href: '/watchlist', cta: 'Open →' },
          { title: 'Portfolio', desc: 'Monitor your holdings, P&L, and overall portfolio health.', href: '/portfolio', cta: 'Open →' },
        ].map((card) => (
          <Link
            key={card.href}
            href={card.href}
            style={{
              display: 'block',
              padding: '20px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              textDecoration: 'none',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>{card.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 16 }}>{card.desc}</div>
            <div style={{ fontSize: 12, color: 'var(--accent)' }}>{card.cta}</div>
          </Link>
        ))}
      </div>

    </div>
  );
}
