'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import SearchBar from '@/components/ui/SearchBar';

const NAV_ITEMS = [
  { href: '/',          label: 'Dashboard',  icon: '⬡' },
  { href: '/screener',  label: 'Screener',   icon: '⊞' },
  { href: '/watchlist', label: 'Watchlist',  icon: '◈' },
  { href: '/portfolio', label: 'Portfolio',  icon: '▦' },
  { href: '/alerts',    label: 'Alerts',     icon: '◎' },
  { href: '/zerodha',       label: 'Zerodha',      icon: '⟡' },
  { href: '/paper-trading', label: 'Paper Trades', icon: '◉' },
  { href: '/research/%5ENSEI?name=Nifty%2050', label: 'Research', icon: '◇' },
];

const TICKER_ITEMS = [
  { symbol: 'NIFTY 50',   value: '24,508.00', change: '+0.42%',  up: true },
  { symbol: 'BANKNIFTY',  value: '52,140.85', change: '+0.87%',  up: true },
  { symbol: 'SENSEX',     value: '80,620.40', change: '+0.35%',  up: true },
  { symbol: 'MIDCAP 150', value: '18,930.10', change: '-0.12%',  up: false },
  { symbol: 'USD/INR',    value: '83.42',     change: '-0.08%',  up: false },
  { symbol: 'GOLD',       value: '71,240',    change: '+0.21%',  up: true },
  { symbol: 'CRUDE OIL',  value: '6,812',     change: '-0.54%',  up: false },
  { symbol: 'VIX',        value: '14.20',     change: '+3.20%',  up: true },
];

function MarketTicker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        height: 32,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          animation: 'ticker-scroll 55s linear infinite',
          whiteSpace: 'nowrap',
        }}
      >
        {items.map((item, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 28px',
              fontSize: 11,
              letterSpacing: '0.02em',
              borderRight: '1px solid var(--border)',
            }}
          >
            <span style={{ color: 'var(--text3)', fontWeight: 500 }}>{item.symbol}</span>
            <span style={{ color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>{item.value}</span>
            <span style={{ color: item.up ? 'var(--green)' : 'var(--red)', fontFamily: 'DM Mono, monospace' }}>
              {item.change}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function MarketStatus() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const day = ist.getDay();
      const h = ist.getHours();
      const m = ist.getMinutes();
      const mins = h * 60 + m;
      setIsOpen(day >= 1 && day <= 5 && mins >= 555 && mins < 930);
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: isOpen ? 'var(--green)' : 'var(--text3)',
          boxShadow: isOpen ? '0 0 6px var(--green-glow)' : 'none',
          animation: isOpen ? 'glow-pulse 1.5s ease-in-out infinite' : 'none',
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 11, color: 'var(--text3)' }}>
        {isOpen ? 'Market open' : 'Market closed'}
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSelectStock = (symbol: string, name: string) => {
    router.push(`/research/${encodeURIComponent(symbol)}?name=${encodeURIComponent(name)}`);
  };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href.split('?')[0]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Sidebar ─────────────────────────────── */}
      <aside
        className="hidden xl:flex"
        style={{
          width: 216,
          minHeight: '100vh',
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div
            style={{
              padding: '20px 20px 18px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 10,
              }}
            >
              {/* Logo mark */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: 'var(--accent-dim)',
                  border: '1px solid rgba(99,102,241,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  color: 'var(--accent)',
                  flexShrink: 0,
                }}
              >
                ▲
              </div>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text)',
                    fontFamily: 'Bricolage Grotesque, DM Sans, sans-serif',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Investor OS
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  NSE · BSE · AMFI
                </div>
              </div>
            </div>
            <MarketStatus />
          </div>
        </Link>

        {/* Nav */}
        <nav style={{ padding: '12px 10px', flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '6px 12px 8px', fontWeight: 500 }}>
            Navigate
          </div>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${active ? ' active' : ''}`}
                style={{ marginBottom: 2, display: 'flex' }}
              >
                <span className="nav-icon" style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {active && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      flexShrink: 0,
                    }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.6 }}>
            Real-time Indian markets<br />
            Powered by Yahoo Finance + Kite
          </div>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Ticker strip */}
        <MarketTicker />

        {/* Top bar */}
        <header
          className="glass-strong"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            borderBottom: '1px solid var(--border)',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          {/* Mobile logo */}
          <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }} className="xl:hidden">
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: 'var(--accent-dim)',
                border: '1px solid rgba(99,102,241,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: 'var(--accent)',
              }}
            >
              ▲
            </div>
          </Link>

          {/* Search */}
          <div style={{ flex: 1, maxWidth: 520 }}>
            <SearchBar onSelectStock={handleSelectStock} />
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--surface2)', borderRadius: 6, border: '1px solid var(--border2)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 4px var(--green-glow)', display: 'inline-block', animation: 'glow-pulse 1.5s ease-in-out infinite' }} />
              <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'DM Mono, monospace' }}>LIVE</span>
            </div>
          </div>

          {/* Mobile nav */}
          <nav style={{ display: 'flex', gap: 4, overflowX: 'auto' }} className="xl:hidden">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '5px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: active ? 500 : 400,
                    color: active ? 'var(--text)' : 'var(--text2)',
                    background: active ? 'var(--surface2)' : 'transparent',
                    textDecoration: 'none',
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        {/* Page */}
        <main style={{ flex: 1, padding: '24px', maxWidth: 1400, width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
