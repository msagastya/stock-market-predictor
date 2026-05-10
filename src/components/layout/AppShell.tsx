'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import SearchBar from '@/components/ui/SearchBar';

const NAV_ITEMS = [
  { href: '/', label: 'Market', icon: '▦' },
  { href: '/screener', label: 'Screener', icon: '⊞' },
  { href: '/watchlist', label: 'Watchlist', icon: '☆' },
  { href: '/portfolio', label: 'Portfolio', icon: '◈' },
  { href: '/alerts', label: 'Alerts', icon: '◎' },
  { href: '/zerodha', label: 'Zerodha', icon: '⟡' },
  { href: '/research/%5ENSEI?name=Nifty%2050', label: 'Research', icon: '◇' },
];

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

      {/* Sidebar */}
      <aside style={{
        width: 220,
        minHeight: '100vh',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 0',
        position: 'sticky',
        top: 0,
        height: '100vh',
        flexShrink: 0,
      }}
        className="hidden xl:flex"
      >
        {/* Logo */}
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
              Investor OS
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              Market Predictor
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ padding: '16px 12px', flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 6,
                  marginBottom: 2,
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  color: active ? 'var(--text)' : 'var(--text2)',
                  background: active ? 'var(--surface2)' : 'transparent',
                  transition: 'all 0.1s',
                  borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                <span style={{ fontSize: 14, opacity: 0.7 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>NSE · BSE · AMFI · Zerodha</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Real-time Indian markets</div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Top bar */}
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'rgba(10,10,10,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          {/* Mobile logo */}
          <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }} className="xl:hidden">
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Market Predictor</span>
          </Link>

          {/* Search */}
          <div style={{ flex: 1, maxWidth: 480 }}>
            <SearchBar onSelectStock={handleSelectStock} />
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
                    padding: '6px 12px',
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

        {/* Page content */}
        <main style={{ flex: 1, padding: '24px', maxWidth: 1400, width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
