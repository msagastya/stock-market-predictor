'use client';

import { AutomatedAnalysis } from '@/types';

function toneClass(tone: 'positive' | 'negative' | 'neutral') {
  if (tone === 'positive') return 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10';
  if (tone === 'negative') return 'text-rose-300 border-rose-500/20 bg-rose-500/10';
  return 'text-slate-300 border-white/10 bg-white/5';
}

function biasClass(bias: 'bullish' | 'bearish' | 'neutral') {
  if (bias === 'bullish') return 'text-emerald-300';
  if (bias === 'bearish') return 'text-rose-300';
  return 'text-slate-300';
}

export function AutomatedAnalysisPanel({ analysis }: { analysis: AutomatedAnalysis | null }) {
  if (!analysis) {
    return null;
  }

  return (
    <section className="space-y-6 rounded-[28px] border border-white/10 bg-slate-950/50 p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.35em] text-blue-300">Automated Analyzer</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Trade Plan Engine</h2>
        </div>
        <div className="rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-100">
          Regime: {analysis.marketRegime}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {analysis.scorecard.map((item) => (
          <div key={item.label} className={`rounded-2xl border p-4 ${toneClass(item.tone)}`}>
            <div className="text-xs uppercase tracking-[0.25em]">{item.label}</div>
            <div className="mt-2 text-lg font-semibold">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InsightCard title="Trend">
          {analysis.trendSummary}
        </InsightCard>
        <InsightCard title="Momentum">
          {analysis.momentumSummary}
        </InsightCard>
        <InsightCard title="Levels">
          {analysis.levelSummary}
        </InsightCard>
        <InsightCard title="Risk">
          {analysis.riskSummary}
        </InsightCard>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="text-sm font-semibold text-white">Strategic Summary</div>
        <p className="mt-2 text-sm leading-6 text-slate-300">{analysis.strategicSummary}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {analysis.setups.map((setup) => (
          <div key={setup.title} className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-white">{setup.title}</h3>
              <span className={`text-sm font-medium uppercase ${biasClass(setup.bias)}`}>{setup.bias}</span>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <div>Entry: {setup.entry}</div>
              <div>Stop: {setup.stopLoss}</div>
              <div>Target: {setup.target}</div>
              <div>Risk/Reward: {setup.riskReward}</div>
              <div>Confidence: {setup.confidence}</div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-400">{setup.rationale}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function InsightCard({ title, children }: { title: string; children: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{children}</p>
    </div>
  );
}
