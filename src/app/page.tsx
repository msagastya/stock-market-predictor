'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MarketOverview } from '@/features/market/components/MarketOverview';
import PredictiveMovers from '@/components/PredictiveMovers';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const QUICK_LINKS = [
  { symbol: '^NSEI',       name: 'Nifty 50' },
  { symbol: '^NSEBANK',    name: 'Bank Nifty' },
  { symbol: '^BSESN',      name: 'Sensex' },
  { symbol: 'RELIANCE.NS', name: 'Reliance' },
  { symbol: 'TCS.NS',      name: 'TCS' },
  { symbol: 'INFY.NS',     name: 'Infosys' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
  { symbol: 'ICICIBANK.NS',name: 'ICICI Bank' },
  { symbol: 'BAJFINANCE.NS',name: 'Bajaj Finance' },
  { symbol: 'WIPRO.NS',    name: 'Wipro' },
];

const FEATURE_CARDS = [
  {
    title: 'Research',
    desc: 'Deep-dive into any symbol with charts, technicals, and AI analysis.',
    href: '/research/%5ENSEI?name=Nifty%2050',
    icon: '◇',
    accent: 'var(--accent)',
    accentDim: 'var(--accent-dim)',
    accentBorder: 'rgba(99,102,241,0.2)',
  },
  {
    title: 'Watchlist',
    desc: 'Track your favourite stocks and jump straight into research.',
    href: '/watchlist',
    icon: '◈',
    accent: 'var(--green)',
    accentDim: 'var(--green-dim)',
    accentBorder: 'rgba(52,211,153,0.15)',
  },
  {
    title: 'Portfolio',
    desc: 'Monitor your holdings, P&L, and overall portfolio health.',
    href: '/portfolio',
    icon: '▦',
    accent: 'var(--amber)',
    accentDim: 'var(--amber-dim)',
    accentBorder: 'rgba(251,191,36,0.15)',
  },
];

export default function Home() {
  const router = useRouter();

  return (
    <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── Page header ──────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6, fontWeight: 500 }}>
            Dashboard
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', fontFamily: 'Bricolage Grotesque, DM Sans, sans-serif' }}>
            Market Overview
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/zerodha" className="btn btn-primary btn-sm">
            <span style={{ fontSize: 11 }}>⟡</span> Zerodha
          </Link>
          <Link href="/screener" className="btn btn-secondary btn-sm">
            <span style={{ fontSize: 11 }}>⊞</span> Screener
          </Link>
        </div>
      </div>

      {/* ── Quick access ─────────────────────── */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, fontWeight: 500 }}>
          Quick Access
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {QUICK_LINKS.map((item) => (
            <button
              key={item.symbol}
              onClick={() => router.push(`/research/${encodeURIComponent(item.symbol)}?name=${encodeURIComponent(item.name)}`)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text2)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'DM Sans, sans-serif',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = 'var(--text)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border3)';
                (e.currentTarget as HTMLElement).style.background = 'var(--surface2)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = 'var(--text2)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Market overview ───────────────────── */}
      <ErrorBoundary>
        <MarketOverview
          onSelectStock={(symbol, name) => router.push(`/research/${encodeURIComponent(symbol)}?name=${encodeURIComponent(name)}`)}
        />
      </ErrorBoundary>

      {/* ── Predictive movers ─────────────────── */}
      <ErrorBoundary>
        <PredictiveMovers />
      </ErrorBoundary>

      {/* ── Feature cards ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {FEATURE_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            style={{
              display: 'block',
              padding: '20px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              textDecoration: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = card.accentBorder;
              e.currentTarget.style.boxShadow = `0 0 0 1px ${card.accentBorder}, 0 8px 24px rgba(0,0,0,0.3)`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: card.accentDim,
                border: `1px solid ${card.accentBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                color: card.accent,
                marginBottom: 14,
              }}
            >
              {card.icon}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6, fontFamily: 'Bricolage Grotesque, DM Sans, sans-serif', letterSpacing: '-0.02em' }}>
              {card.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 14 }}>
              {card.desc}
            </div>
            <div style={{ fontSize: 11, color: card.accent, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
              Open <span style={{ fontSize: 14 }}>→</span>
            </div>
          </Link>
        ))}
      </div>

    </div>
  );
}
