'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import SearchBar from '@/components/ui/SearchBar';
import { classNames } from '@/lib/utils/format';

const NAV_ITEMS = [
  { href: '/', label: 'Market' },
  { href: '/screener', label: 'Screener' },
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/research/%5ENSEI?name=Nifty%2050', label: 'Research' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSelectStock = (symbol: string, name: string) => {
    router.push(`/research/${encodeURIComponent(symbol)}?name=${encodeURIComponent(name)}`);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(29,78,216,0.18),_transparent_28%),linear-gradient(180deg,_#0b1220_0%,_#0f172a_42%,_#020617_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-slate-950/70 p-6 backdrop-blur xl:block">
          <Link href="/" className="block">
            <div className="text-xs uppercase tracking-[0.35em] text-blue-300">Investor OS</div>
            <div className="mt-3 text-2xl font-semibold text-white">Stock Market Predictor</div>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Market terminal, research desk, and portfolio workspace in one shell.
            </p>
          </Link>

          <nav className="mt-10 space-y-2">
            {NAV_ITEMS.map((item) => {
              const active = item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href.split('?')[0]);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={classNames(
                    'block rounded-xl px-4 py-3 text-sm transition-colors',
                    active
                      ? 'bg-blue-500/15 text-white ring-1 ring-blue-400/40'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-widest text-slate-500">Build Status</div>
            <div className="mt-3 text-lg font-semibold">Foundation In Progress</div>
            <p className="mt-2 text-sm text-slate-400">
              Shell, research routes, portfolio pages, and real data wiring are live. Auth and persistence are next.
            </p>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur">
            <div className="flex flex-col gap-4 px-4 py-4 lg:px-8">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Workspace</div>
                  <div className="mt-1 text-xl font-semibold text-white">Market Intelligence Platform</div>
                </div>
                <div className="w-full max-w-2xl">
                  <SearchBar onSelectStock={handleSelectStock} />
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto xl:hidden">
                {NAV_ITEMS.map((item) => {
                  const active = item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href.split('?')[0]);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={classNames(
                        'whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors',
                        active
                          ? 'bg-blue-500/15 text-white ring-1 ring-blue-400/40'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
