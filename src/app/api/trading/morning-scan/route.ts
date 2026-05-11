import { NextResponse } from 'next/server';
import { firestoreSet, firestoreGet } from '@/lib/firebase-store';
import { runMorningScan } from '@/lib/trading/morning-scanner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
    const secret = req.headers.get('x-trading-secret');
    if (secret !== process.env.TRADING_SECRET) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    try {
        const scan = await runMorningScan();
        const dateStr = scan.date;

        await firestoreSet('morning_scan', dateStr, {
            date: scan.date,
            dayBias: scan.dayBias,
            sectorPriority: JSON.stringify(scan.sectorPriority),
            watchlist: JSON.stringify(scan.todayWatchlist),
            keyLevels: JSON.stringify(scan.keyLevels),
            alerts: JSON.stringify(scan.alerts),
            tradingPlan: scan.tradingPlan,
            globalSnapshot: JSON.stringify(scan.globalSnapshot),
            createdAt: new Date().toISOString(),
        });

        return NextResponse.json({ ok: true, date: dateStr, stocks: scan.todayWatchlist.length, bias: scan.dayBias });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function GET() {
    try {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const doc = await firestoreGet('morning_scan', today);
        if (!doc) return NextResponse.json({ error: 'No scan for today' }, { status: 404 });

        return NextResponse.json({
            date: doc.date,
            dayBias: doc.dayBias,
            sectorPriority: JSON.parse(doc.sectorPriority || '[]'),
            watchlist: JSON.parse(doc.watchlist || '[]'),
            keyLevels: JSON.parse(doc.keyLevels || '{}'),
            alerts: JSON.parse(doc.alerts || '[]'),
            tradingPlan: doc.tradingPlan,
            globalSnapshot: JSON.parse(doc.globalSnapshot || '{}'),
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
