import { NextRequest, NextResponse } from 'next/server';
import { pickTradeCandidates, executeTrades } from '@/lib/trading/autonomous-engine';
import { hasKiteCredentials } from '@/lib/api/kite-connect';

// Called by Cloud Scheduler at 9:15 AM IST daily
// Also callable manually from the dashboard
export async function POST(req: NextRequest) {
    // Verify internal secret to prevent unauthorized triggers
    const secret = req.headers.get('x-trading-secret');
    if (secret !== process.env.TRADING_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasKiteCredentials()) {
        return NextResponse.json({ error: 'Kite session expired — please login' }, { status: 401 });
    }

    try {
        const candidates = await pickTradeCandidates();

        if (candidates.length === 0) {
            return NextResponse.json({ message: 'No qualifying trades found today', trades: [] });
        }

        const session = await executeTrades(candidates);
        return NextResponse.json({ success: true, session });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// GET — preview today's picks without placing orders
export async function GET(req: NextRequest) {
    const secret = req.headers.get('x-trading-secret');
    if (secret !== process.env.TRADING_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const candidates = await pickTradeCandidates();
        return NextResponse.json({ candidates });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
