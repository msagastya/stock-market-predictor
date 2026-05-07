 'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MarketOverview } from '@/features/market/components/MarketOverview';
import PredictiveMovers from '@/components/PredictiveMovers';

export default function Home() {
  const router = useRouter();
  const quickResearch = [
    { symbol: '^NSEI', name: 'Nifty 50' },
    { symbol: '^NSEBANK', name: 'Nifty Bank' },
    { symbol: '^BSESN', name: 'Sensex' },
    { symbol: 'RELIANCE.NS', name: 'Reliance' },
    { symbol: 'TCS.NS', name: 'TCS' },
    { symbol: 'INFY.NS', name: 'Infosys' },
  ];

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 backdrop-blur">
        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-blue-300">Automated Market Terminal</div>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-white md:text-5xl">
              Analyze Indian stocks, watch global risk, and turn raw charts into trade-ready plans.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300">
              The app now focuses on India-first market intelligence with global index awareness, automated support and
              resistance mapping, momentum diagnostics, and strategy playbooks that turn chart structure into actionable setups.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/research/%5ENSEI?name=Nifty%2050" className="btn btn-primary">
                Open Nifty Research
              </Link>
              <Link href="/watchlist" className="btn btn-secondary">
                Open Watchlist
              </Link>
              <Link href="/portfolio" className="btn btn-secondary">
                Open Portfolio
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {quickResearch.map((item) => (
                <button
                  key={item.symbol}
                  onClick={() => router.push(`/research/${encodeURIComponent(item.symbol)}?name=${encodeURIComponent(item.name)}`)}
                  className="rounded-full border border-white/10 bg-slate-950/50 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-900"
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            <InfoCard title="Market Pulse" description="India indices, global indices, and liquid Indian leaders visible from the home screen." />
            <InfoCard title="Strategy Engine" description="Automated trend, momentum, support/resistance, and trade-setup generation." />
            <InfoCard title="Research Flow" description="Dedicated workspace per symbol with chart, levels, peers, news, and risk framing." />
          </div>
        </div>
      </section>

      <MarketOverview
        onSelectStock={(symbol, name) => {
          router.push(`/research/${encodeURIComponent(symbol)}?name=${encodeURIComponent(name)}`);
        }}
      />

      <PredictiveMovers />

      <section className="grid gap-6 lg:grid-cols-3">
        <PreviewCard
          title="Research Workspace"
          description="Open a symbol into a full automated market analyzer with structure, setups, and confirmation signals."
          href="/research/%5ENSEI?name=Nifty%2050"
          cta="Open Research"
        />
        <PreviewCard
          title="Watchlist"
          description="Track Indian equities and move straight from list management into live research."
          href="/watchlist"
          cta="Open Watchlist"
        />
        <PreviewCard
          title="Portfolio"
          description="Review positions, live value changes, and P&L alongside stronger market context."
          href="/portfolio"
          cta="Open Portfolio"
        />
      </section>
    </div>
  );
}

function InfoCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </div>
  );
}

function PreviewCard({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="text-xl font-semibold text-white">{title}</div>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">{description}</p>
      <Link href={href} className="mt-6 inline-flex rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-200 transition-colors hover:bg-blue-500/20">
        {cta}
      </Link>
    </div>
  );
}
