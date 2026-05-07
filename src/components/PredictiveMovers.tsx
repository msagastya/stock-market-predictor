'use client';

import { useEffect, useState } from 'react';

interface ScoredStock {
    symbol: string;
    name: string;
    price: number;
    changePercent: number;
    score: number;
    confidence: 'high' | 'medium' | 'low';
    signals: string[];
    perChange30d: number;
    perChange365d: number;
    belowYearHigh: number;
    aboveYearLow: number;
    sector: string;
}

interface PredictiveData {
    bullish: ScoredStock[];
    bearish: ScoredStock[];
    meta: { universe: number; timestamp: string };
}

const CONFIDENCE_BADGE: Record<string, string> = {
    high: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    medium: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    low: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
};

function ScoreBar({ score, max = 120 }: { score: number; max?: number }) {
    const pct = Math.min((score / max) * 100, 100);
    return (
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-current rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
    );
}

function StockCard({ stock, side }: { stock: ScoredStock; side: 'bull' | 'bear' }) {
    const isBull = side === 'bull';
    const accent = isBull ? 'text-emerald-400' : 'text-rose-400';
    const barColor = isBull ? 'text-emerald-400' : 'text-rose-400';

    return (
        <div className={`rounded-xl p-4 border transition-all hover:scale-[1.01] ${isBull ? 'bg-emerald-950/30 border-emerald-800/30 hover:border-emerald-600/40' : 'bg-rose-950/30 border-rose-800/30 hover:border-rose-600/40'}`}>
            <div className="flex items-start justify-between mb-2">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{stock.symbol.replace('.NS', '')}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${CONFIDENCE_BADGE[stock.confidence]}`}>
                            {stock.confidence}
                        </span>
                    </div>
                    <div className="text-xs text-slate-400 truncate max-w-[160px]">{stock.name}</div>
                    {stock.sector && <div className="text-xs text-slate-500 mt-0.5">{stock.sector}</div>}
                </div>
                <div className="text-right">
                    <div className="text-white font-semibold text-sm">₹{stock.price.toLocaleString('en-IN')}</div>
                    <div className={`text-xs font-medium ${stock.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {stock.changePercent >= 0 ? '▲' : '▼'}{Math.abs(stock.changePercent).toFixed(2)}% today
                    </div>
                </div>
            </div>

            <div className={`${barColor} mb-2`}>
                <ScoreBar score={stock.score} />
            </div>

            <div className="grid grid-cols-3 gap-1 mb-2 text-center">
                <div className="bg-white/5 rounded p-1">
                    <div className="text-xs text-slate-400">30d</div>
                    <div className={`text-xs font-bold ${stock.perChange30d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {stock.perChange30d >= 0 ? '+' : ''}{stock.perChange30d.toFixed(1)}%
                    </div>
                </div>
                <div className="bg-white/5 rounded p-1">
                    <div className="text-xs text-slate-400">1Y</div>
                    <div className={`text-xs font-bold ${stock.perChange365d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {stock.perChange365d >= 0 ? '+' : ''}{stock.perChange365d.toFixed(0)}%
                    </div>
                </div>
                <div className="bg-white/5 rounded p-1">
                    <div className="text-xs text-slate-400">52wH dist</div>
                    <div className="text-xs font-bold text-slate-300">
                        -{stock.belowYearHigh.toFixed(1)}%
                    </div>
                </div>
            </div>

            <div className="space-y-1">
                {stock.signals.slice(0, 3).map((sig, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                        <span className={`text-xs mt-0.5 ${accent}`}>›</span>
                        <span className="text-xs text-slate-300">{sig}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function PredictiveMovers() {
    const [data, setData] = useState<PredictiveData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<string>('');

    async function load() {
        try {
            setLoading(true);
            const r = await fetch('/api/market/predictive-movers');
            if (!r.ok) throw new Error('Failed to fetch');
            const d = await r.json();
            setData(d);
            setLastUpdate(new Date().toLocaleTimeString('en-IN'));
            setError(null);
        } catch (e) {
            setError('Failed to load predictive movers');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        const id = setInterval(load, 5 * 60 * 1000); // refresh every 5 min
        return () => clearInterval(id);
    }, []);

    if (loading && !data) {
        return (
            <div className="rounded-2xl bg-slate-900/50 border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                        <span className="text-violet-400 text-sm">⚡</span>
                    </div>
                    <h2 className="text-white font-semibold text-lg">Predictive Movers</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-40 rounded-xl bg-white/5 animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl bg-slate-900/50 border border-white/10 p-6">
                <p className="text-rose-400 text-sm">{error}</p>
                <button onClick={load} className="mt-2 text-xs text-slate-400 underline">Retry</button>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="rounded-2xl bg-slate-900/50 border border-white/10 p-6">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                        <span className="text-violet-400 text-sm">⚡</span>
                    </div>
                    <div>
                        <h2 className="text-white font-semibold text-lg">Predictive Movers</h2>
                        <p className="text-xs text-slate-400">
                            Scored across {data.meta.universe} NSE stocks · Updated {lastUpdate}
                        </p>
                    </div>
                </div>
                <button onClick={load} className="text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10">
                    {loading ? 'Refreshing…' : 'Refresh'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bullish */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-emerald-400 font-semibold text-sm">▲ Top 5 Bullish</span>
                        <span className="text-xs text-slate-500">— predicted upside</span>
                    </div>
                    <div className="space-y-3">
                        {data.bullish.map(s => <StockCard key={s.symbol} stock={s} side="bull" />)}
                        {data.bullish.length === 0 && <p className="text-slate-500 text-sm">No strong bullish setups found</p>}
                    </div>
                </div>

                {/* Bearish */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-rose-400 font-semibold text-sm">▼ Top 5 Bearish</span>
                        <span className="text-xs text-slate-500">— predicted downside</span>
                    </div>
                    <div className="space-y-3">
                        {data.bearish.map(s => <StockCard key={s.symbol} stock={s} side="bear" />)}
                        {data.bearish.length === 0 && <p className="text-slate-500 text-sm">No strong bearish setups found</p>}
                    </div>
                </div>
            </div>

            <p className="text-xs text-slate-600 mt-4 text-center">
                Scoring based on 30d/1Y momentum, 52w range proximity, volume, and session pattern · Not financial advice
            </p>
        </div>
    );
}
