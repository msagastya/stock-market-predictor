/**
 * Accurate Zerodha charge calculator for NSE equity
 * All rates as of 2024 — verify against Zerodha's brokerage calculator
 */

export interface TradeCharges {
    brokerage: number;
    stt: number;
    exchangeTxn: number;
    gst: number;
    sebi: number;
    stampDuty: number;
    total: number;
    netPnL: number;
    effectivePnLPercent: number;
}

export interface TradeInput {
    buyPrice: number;
    sellPrice: number;
    quantity: number;
    type: 'intraday' | 'delivery';
}

export function calculateCharges(trade: TradeInput): TradeCharges {
    const { buyPrice, sellPrice, quantity, type } = trade;
    const buyValue  = buyPrice  * quantity;
    const sellValue = sellPrice * quantity;
    const grossPnL  = sellValue - buyValue;

    // Zerodha brokerage: ₹20 or 0.03% per order, whichever is lower
    // Intraday: both sides charged. Delivery: both sides charged.
    const brokeragePerOrder = (value: number) => Math.min(20, value * 0.0003);
    const brokerage = brokeragePerOrder(buyValue) + brokeragePerOrder(sellValue);

    // STT (Securities Transaction Tax)
    // Intraday: 0.025% on sell side only
    // Delivery: 0.1% on both buy and sell
    const stt = type === 'intraday'
        ? sellValue * 0.00025
        : (buyValue + sellValue) * 0.001;

    // NSE Exchange transaction charges: 0.00322% both sides
    const exchangeTxn = (buyValue + sellValue) * 0.0000322;

    // GST: 18% on (brokerage + exchange charges)
    const gst = (brokerage + exchangeTxn) * 0.18;

    // SEBI turnover charges: ₹10 per crore = 0.000001 on turnover
    const sebi = (buyValue + sellValue) * 0.000001;

    // Stamp duty: 0.003% on buy side (intraday), 0.015% on buy side (delivery)
    const stampDuty = type === 'intraday'
        ? buyValue * 0.00003
        : buyValue * 0.00015;

    const total = brokerage + stt + exchangeTxn + gst + sebi + stampDuty;
    const netPnL = grossPnL - total;
    const effectivePnLPercent = (netPnL / buyValue) * 100;

    return {
        brokerage: round(brokerage),
        stt:       round(stt),
        exchangeTxn: round(exchangeTxn),
        gst:       round(gst),
        sebi:      round(sebi),
        stampDuty: round(stampDuty),
        total:     round(total),
        netPnL:    round(netPnL),
        effectivePnLPercent: round(effectivePnLPercent, 4),
    };
}

/** Minimum gross profit % needed to break even after charges */
export function breakEvenPercent(price: number, quantity: number, type: TradeInput['type']): number {
    const charges = calculateCharges({ buyPrice: price, sellPrice: price * 1.02, quantity, type });
    // Iterate to find exact breakeven
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        const c = calculateCharges({ buyPrice: price, sellPrice: price * (1 + mid / 100), quantity, type });
        if (c.netPnL > 0) hi = mid; else lo = mid;
    }
    return round((lo + hi) / 2, 4);
}

/** Is a trade worth taking? Returns false if expected target doesn't cover charges × 2 */
export function isTradeWorthTaking(params: {
    entryPrice: number;
    targetPercent: number; // gross % target
    quantity: number;
    type: TradeInput['type'];
}): { worth: boolean; reason: string; chargePercent: number; netTargetPercent: number } {
    const { entryPrice, targetPercent, quantity, type } = params;
    const targetPrice = entryPrice * (1 + targetPercent / 100);
    const c = calculateCharges({ buyPrice: entryPrice, sellPrice: targetPrice, quantity, type });
    const chargePercent = (c.total / (entryPrice * quantity)) * 100;
    const netTargetPercent = targetPercent - chargePercent;
    const worth = netTargetPercent >= chargePercent * 2; // target must be 3x charges minimum

    return {
        worth,
        reason: worth
            ? `Net ${netTargetPercent.toFixed(3)}% after ₹${c.total.toFixed(2)} charges`
            : `Charges (${chargePercent.toFixed(3)}%) eat too much of ${targetPercent}% target`,
        chargePercent: round(chargePercent, 4),
        netTargetPercent: round(netTargetPercent, 4),
    };
}

function round(n: number, d = 2) {
    return Math.round(n * 10 ** d) / 10 ** d;
}
