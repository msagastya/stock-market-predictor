import { NextResponse } from 'next/server';
import { cachedFetch } from '@/lib/api/cache-manager';
import { fetchNSEIndexData } from '@/lib/api/nse-india';

export const dynamic = 'force-dynamic';

async function fetchNifty500(): Promise<any[]> {
    return fetchNSEIndexData('NIFTY 500');
}

interface ScoredStock {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    score: number;
    confidence: 'high' | 'medium' | 'low';
    signals: string[];
    perChange30d: number;
    perChange365d: number;
    belowYearHigh: number;   // % below 52w high (0 = at high, +15 = 15% below)
    aboveYearLow: number;    // % above 52w low (0 = at low, 20 = 20% above)
    volume: number;
    turnover: number;
    sector: string;
    yearHigh: number;
    yearLow: number;
}

function scoreStock(d: any): { bullish: number; bearish: number; signals: string[] } {
    let bull = 0;
    let bear = 0;
    const signals: string[] = [];

    const p30 = d.perChange30d ?? 0;
    const p365 = d.perChange365d ?? 0;
    const pDay = d.pChange ?? 0;
    // NSE semantics (verified against live data):
    //   nearWKH = +22 means 22% BELOW 52w high (positive = below high, 0 = at high)
    //   nearWKL = -9.5 means 9.5% ABOVE 52w low (negative = above low, 0 = at low)
    const nwkh = d.nearWKH ?? 0;
    const nwkl = d.nearWKL ?? 0;
    const tv = d.totalTradedValue ?? 0;
    const tvLog = tv > 0 ? Math.log10(tv) : 0;

    // ── 30-day momentum ────────────────────────────────────────────────────────
    if (p30 > 10) { bull += 30; signals.push(`+${p30.toFixed(1)}% last 30d`); }
    else if (p30 > 3) { bull += 15; signals.push(`+${p30.toFixed(1)}% last 30d`); }
    else if (p30 < -10) { bear += 30; signals.push(`${p30.toFixed(1)}% last 30d`); }
    else if (p30 < -3) { bear += 15; signals.push(`${p30.toFixed(1)}% last 30d`); }

    // ── 1-year trend ──────────────────────────────────────────────────────────
    if (p365 > 20) { bull += 15; signals.push(`+${p365.toFixed(0)}% 1Y trend`); }
    else if (p365 > 0) bull += 5;
    else if (p365 < -20) { bear += 15; signals.push(`${p365.toFixed(0)}% 1Y trend`); }
    else if (p365 < 0) bear += 5;

    // ── Today's session ───────────────────────────────────────────────────────
    // Slight pullback in an uptrend = buy dip signal
    if (pDay < -0.5 && p30 > 5) { bull += 20; signals.push(`Pullback in uptrend (${pDay.toFixed(1)}% today)`); }
    // Slight bounce in a downtrend = dead cat = sell signal
    if (pDay > 1 && p30 < -5) { bear += 20; signals.push(`Dead-cat bounce (${pDay.toFixed(1)}% today)`); }
    // Strong day already = momentum continuation, lower edge
    if (pDay > 3 && p30 > 5) { bull += 10; signals.push(`Momentum day +${pDay.toFixed(1)}%`); }

    // ── Breakout / breakdown proximity ────────────────────────────────────────
    // nwkh: 0 = at 52w high, +15 = 15% below 52w high, +50 = 50% below high
    // "approaching breakout" zone: within 3-15% below 52w high with uptrend
    if (nwkh >= 0 && nwkh < 3 && p30 > 0) {
        bull += 15; signals.push(`At 52w high — momentum breakout`);
    } else if (nwkh >= 3 && nwkh < 15 && p30 > 0) {
        bull += 25; signals.push(`${nwkh.toFixed(1)}% below 52w high — breakout watch`);
    }
    // "overbought distribution" zone: at 52w high but trend deteriorating
    if (nwkh < 5 && p30 < -5) {
        bear += 20; signals.push(`Near 52w high but momentum failing — distribution risk`);
    }
    // nwkl: 0 = at 52w low, -10 = 10% above 52w low (more negative = further from low)
    // "breakdown risk" zone: within 15% above 52w low with downtrend
    const aboveLow = Math.abs(nwkl); // % above 52w low (absolute distance)
    if (aboveLow < 15 && p30 < 0) {
        bear += 25; signals.push(`${aboveLow.toFixed(1)}% above 52w low — breakdown risk`);
    }

    // ── Liquidity (institutional interest) ────────────────────────────────────
    // tvLog ≈ 9-10 for ~₹1B-₹10B turnover (very liquid)
    if (tvLog > 9.5) { bull += 10; bear += 5; signals.push('High institutional volume'); }
    else if (tvLog > 8.5) { bull += 5; bear += 3; }

    // ── Volume surge (intraday) ───────────────────────────────────────────────
    // We don't have avg volume, but turnover vs market cap ratio gives a proxy
    const mc = d.ffmc ?? 1;
    const tvRatio = mc > 0 ? tv / mc : 0; // daily turnover / free float mkt cap
    if (tvRatio > 0.015 && pDay > 0) { bull += 15; signals.push('Volume surge on up move'); }
    if (tvRatio > 0.015 && pDay < 0) { bear += 15; signals.push('Volume surge on down move'); }

    return { bullish: bull, bearish: bear, signals };
}

function confidenceLevel(score: number): 'high' | 'medium' | 'low' {
    if (score >= 70) return 'high';
    if (score >= 45) return 'medium';
    return 'low';
}

export async function GET() {
    try {
        const result = await cachedFetch('predictive-movers', async () => {
            const raw = await fetchNifty500();

            // Filter: skip the index row (symbol starts with ^), penny stocks, illiquid
            const stocks = raw.filter((d: any) =>
                d.symbol && !d.symbol.startsWith('^')
                && d.lastPrice >= 30
                && (d.totalTradedValue ?? 0) >= 50_000_000 // ₹5 Cr minimum turnover
                && d.meta?.isSuspended !== true
                && d.meta?.isDelisted !== true
                && d.meta?.isETFSec !== true
            );

            const scored: Array<{ bull: number; bear: number; d: any; signals: string[] }> = stocks.map((d: any) => {
                const s = scoreStock(d);
                return { bull: s.bullish, bear: s.bearish, d, signals: s.signals };
            });

            // Top 5 bullish: highest bull score, bull >> bear
            const bullish: ScoredStock[] = scored
                .filter(s => s.bull > s.bear && s.bull >= 30)
                .sort((a, b) => b.bull - a.bull)
                .slice(0, 5)
                .map(s => ({
                    symbol: s.d.symbol + '.NS',
                    name: s.d.meta?.companyName || s.d.symbol,
                    price: s.d.lastPrice,
                    change: s.d.change,
                    changePercent: s.d.pChange,
                    score: s.bull,
                    confidence: confidenceLevel(s.bull),
                    signals: s.signals,
                    perChange30d: s.d.perChange30d ?? 0,
                    perChange365d: s.d.perChange365d ?? 0,
                    belowYearHigh: s.d.nearWKH ?? 0,
                    aboveYearLow: Math.abs(s.d.nearWKL ?? 0),
                    volume: s.d.totalTradedVolume ?? 0,
                    turnover: s.d.totalTradedValue ?? 0,
                    sector: s.d.meta?.industry || '',
                    yearHigh: s.d.yearHigh ?? 0,
                    yearLow: s.d.yearLow ?? 0,
                }));

            // Top 5 bearish: highest bear score, bear >> bull
            const bearish: ScoredStock[] = scored
                .filter(s => s.bear > s.bull && s.bear >= 30)
                .sort((a, b) => b.bear - a.bear)
                .slice(0, 5)
                .map(s => ({
                    symbol: s.d.symbol + '.NS',
                    name: s.d.meta?.companyName || s.d.symbol,
                    price: s.d.lastPrice,
                    change: s.d.change,
                    changePercent: s.d.pChange,
                    score: s.bear,
                    confidence: confidenceLevel(s.bear),
                    signals: s.signals,
                    perChange30d: s.d.perChange30d ?? 0,
                    perChange365d: s.d.perChange365d ?? 0,
                    belowYearHigh: s.d.nearWKH ?? 0,
                    aboveYearLow: Math.abs(s.d.nearWKL ?? 0),
                    volume: s.d.totalTradedVolume ?? 0,
                    turnover: s.d.totalTradedValue ?? 0,
                    sector: s.d.meta?.industry || '',
                    yearHigh: s.d.yearHigh ?? 0,
                    yearLow: s.d.yearLow ?? 0,
                }));

            const meta = {
                universe: stocks.length,
                timestamp: new Date().toISOString(),
                scoringFactors: ['30d momentum', '1y trend', 'intraday session', '52w high/low proximity', 'volume/liquidity'],
            };

            return { bullish, bearish, meta };
        }, 5); // 5-minute cache

        return NextResponse.json(result);
    } catch (error) {
        console.error('Predictive movers error:', error);
        return NextResponse.json({ error: 'Failed to compute predictive movers', details: String(error) }, { status: 500 });
    }
}
