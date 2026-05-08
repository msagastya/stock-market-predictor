import { fetchNSEIndexData } from '@/lib/api/nse-india';
import {
    placeOrder, getHoldings, getPositions, getKiteMargins,
    createOCOGTT, hasKiteCredentials, toKiteSymbol
} from '@/lib/api/kite-connect';

export interface TradeCandidate {
    symbol: string;
    name: string;
    price: number;
    stopLoss: number;
    target: number;
    riskReward: number;
    score: number;
    tradeType: 'intraday' | 'delivery';
    quantity: number;
    signals: string[];
}

export interface TradingSession {
    date: string;
    trades: PlacedTrade[];
    skipped: string[];
    errors: string[];
    startedAt: string;
}

export interface PlacedTrade {
    symbol: string;
    orderId: string;
    type: 'intraday' | 'delivery';
    buyPrice: number;
    quantity: number;
    stopLoss: number;
    target: number;
    riskReward: number;
    gttId?: number;
    status: 'placed' | 'failed';
}

const INTRADAY_BUDGET = 5000;
const DELIVERY_BUDGET = 5000;
const MIN_RISK_REWARD = 2.0;

function calcSupportResistance(d: any): { support: number; resistance: number } | null {
    const price = d.lastPrice;
    const yearHigh = d.yearHigh;
    const yearLow = d.yearLow;
    if (!price || !yearHigh || !yearLow) return null;

    const range = yearHigh - yearLow;
    // ATR proxy: ~2% of price as daily volatility estimate
    const atr = price * 0.02;

    // Support: nearest significant level below price
    // Use 52w low zone, round numbers, or recent low (prev close - buffer)
    const prevClose = d.previousClose || price;
    const dayLow = d.lowPrice || price * 0.98;

    // Support = max of (day low - 0.5 ATR, year low zone)
    const support = Math.max(
        dayLow - atr * 0.5,
        yearLow + range * 0.05
    );

    // Resistance: nearest significant level above price
    // Use 52w high zone or recent high
    const dayHigh = d.highPrice || price * 1.02;
    const resistance = Math.min(
        dayHigh + atr * 0.5,
        yearHigh * 0.99
    );

    return { support, resistance };
}

function scoreAndFilterStock(d: any): { score: number; signals: string[] } | null {
    const p30 = d.perChange30d ?? 0;
    const pDay = d.pChange ?? 0;
    const nwkh = d.nearWKH ?? 0;
    const nwkl = d.nearWKL ?? 0;
    const tv = d.totalTradedValue ?? 0;
    const mc = d.ffmc ?? 1;
    const tvRatio = mc > 0 ? tv / mc : 0;

    let score = 0;
    const signals: string[] = [];

    if (p30 > 10) { score += 30; signals.push(`+${p30.toFixed(1)}% 30d momentum`); }
    else if (p30 > 3) { score += 15; signals.push(`+${p30.toFixed(1)}% 30d momentum`); }

    if (pDay < -0.5 && p30 > 5) { score += 20; signals.push(`Pullback in uptrend`); }
    if (pDay > 3 && p30 > 5) { score += 10; signals.push(`Momentum day`); }

    if (nwkh >= 3 && nwkh < 15 && p30 > 0) { score += 25; signals.push(`${nwkh.toFixed(1)}% below 52w high`); }
    if (nwkh >= 0 && nwkh < 3 && p30 > 0) { score += 15; signals.push(`At 52w high breakout`); }

    if (tvRatio > 0.015 && pDay > 0) { score += 15; signals.push(`Volume surge`); }

    if (score < 40) return null;
    return { score, signals };
}

export async function pickTradeCandidates(): Promise<TradeCandidate[]> {
    const raw = await fetchNSEIndexData('NIFTY 500');

    const filtered = raw.filter((d: any) =>
        d.symbol && !d.symbol.startsWith('^')
        && d.lastPrice >= 50
        && (d.totalTradedValue ?? 0) >= 50_000_000
        && d.meta?.isSuspended !== true
        && d.meta?.isDelisted !== true
        && d.meta?.isETFSec !== true
    );

    const candidates: TradeCandidate[] = [];

    for (const d of filtered) {
        const scored = scoreAndFilterStock(d);
        if (!scored) continue;

        const sr = calcSupportResistance(d);
        if (!sr) continue;

        const price = d.lastPrice;
        const stopLoss = parseFloat(sr.support.toFixed(2));
        const target = parseFloat(sr.resistance.toFixed(2));

        const risk = price - stopLoss;
        const reward = target - price;

        if (risk <= 0 || reward <= 0) continue;

        const riskReward = reward / risk;
        if (riskReward < MIN_RISK_REWARD) continue;

        // Intraday: top scorer, delivery: next picks
        const intradayQty = Math.floor(INTRADAY_BUDGET / price);
        const deliveryQty = Math.floor(DELIVERY_BUDGET / price);
        if (intradayQty < 1 && deliveryQty < 1) continue;

        candidates.push({
            symbol: d.symbol + '.NS',
            name: d.meta?.companyName || d.symbol,
            price,
            stopLoss,
            target,
            riskReward: parseFloat(riskReward.toFixed(2)),
            score: scored.score,
            tradeType: 'intraday', // will assign below
            quantity: 0,
            signals: scored.signals,
        });
    }

    candidates.sort((a, b) => b.score - a.score);

    const result: TradeCandidate[] = [];

    // Top 1 = intraday
    if (candidates[0]) {
        result.push({
            ...candidates[0],
            tradeType: 'intraday',
            quantity: Math.max(1, Math.floor(INTRADAY_BUDGET / candidates[0].price)),
        });
    }

    // Next 2 = delivery
    for (let i = 1; i <= 2 && i < candidates.length; i++) {
        result.push({
            ...candidates[i],
            tradeType: 'delivery',
            quantity: Math.max(1, Math.floor(DELIVERY_BUDGET / candidates[i].price)),
        });
    }

    return result;
}

export async function executeTrades(candidates: TradeCandidate[]): Promise<TradingSession> {
    const session: TradingSession = {
        date: new Date().toISOString().split('T')[0],
        trades: [],
        skipped: [],
        errors: [],
        startedAt: new Date().toISOString(),
    };

    if (!hasKiteCredentials()) {
        session.errors.push('Kite not authenticated — daily login required');
        return session;
    }

    for (const c of candidates) {
        try {
            const kiteSymbol = toKiteSymbol(c.symbol);
            const exchange = 'NSE';
            const tradingSymbol = c.symbol.replace('.NS', '');

            const orderParams = {
                exchange,
                tradingsymbol: tradingSymbol,
                transaction_type: 'BUY',
                quantity: c.quantity,
                order_type: 'MARKET',
                product: c.tradeType === 'intraday' ? 'MIS' : 'CNC',
            };

            const orderResult = await placeOrder(orderParams);
            const trade: PlacedTrade = {
                symbol: c.symbol,
                orderId: orderResult.order_id,
                type: c.tradeType,
                buyPrice: c.price,
                quantity: c.quantity,
                stopLoss: c.stopLoss,
                target: c.target,
                riskReward: c.riskReward,
                status: 'placed',
            };

            // For delivery trades, set OCO GTT (stop loss + target)
            if (c.tradeType === 'delivery') {
                try {
                    const gtt = await createOCOGTT({
                        symbol: tradingSymbol,
                        lastPrice: c.price,
                        stopLossPrice: c.stopLoss,
                        targetPrice: c.target,
                        quantity: c.quantity,
                        product: 'CNC',
                    });
                    trade.gttId = gtt.trigger_id;
                } catch (gttErr: any) {
                    session.errors.push(`GTT failed for ${c.symbol}: ${gttErr.message}`);
                }
            }

            session.trades.push(trade);
        } catch (err: any) {
            session.errors.push(`Order failed for ${c.symbol}: ${err.message}`);
            session.skipped.push(c.symbol);
        }
    }

    return session;
}
