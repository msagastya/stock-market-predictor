import { NextRequest, NextResponse } from 'next/server';
import { getPositions, placeOrder, hasKiteCredentials } from '@/lib/api/kite-connect';

// Called by Cloud Scheduler at 3:15 PM IST — squares off all MIS positions
export async function POST(req: NextRequest) {
    const secret = req.headers.get('x-trading-secret');
    if (secret !== process.env.TRADING_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasKiteCredentials()) {
        return NextResponse.json({ error: 'Kite session expired' }, { status: 401 });
    }

    try {
        const positions = await getPositions();
        const intradayPositions = (positions.net || []).filter(
            (p: any) => p.product === 'MIS' && p.quantity !== 0
        );

        if (intradayPositions.length === 0) {
            return NextResponse.json({ message: 'No open intraday positions to exit' });
        }

        const results = [];
        for (const pos of intradayPositions) {
            const side = pos.quantity > 0 ? 'SELL' : 'BUY';
            const qty = Math.abs(pos.quantity);
            try {
                const order = await placeOrder({
                    exchange: pos.exchange,
                    tradingsymbol: pos.tradingsymbol,
                    transaction_type: side,
                    quantity: qty,
                    order_type: 'MARKET',
                    product: 'MIS',
                });
                results.push({ symbol: pos.tradingsymbol, status: 'exited', orderId: order.order_id });
            } catch (err: any) {
                results.push({ symbol: pos.tradingsymbol, status: 'failed', error: err.message });
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
