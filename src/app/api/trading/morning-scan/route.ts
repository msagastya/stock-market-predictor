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

        const parseSafe = (val: string | undefined, fallback: any) => {
            if (!val) return fallback;
            try { return JSON.parse(val); } catch { return val; }
        };

        const sectorPriority = parseSafe(doc.sectorPriority, []);
        const alerts = parseSafe(doc.alerts, []);

        return NextResponse.json({
            date: doc.date,
            dayBias: doc.dayBias,
            sectorPriority: Array.isArray(sectorPriority) ? sectorPriority : String(sectorPriority).split(',').map((s: string) => s.trim()),
            watchlist: parseSafe(doc.watchlist, []),
            keyLevels: parseSafe(doc.keyLevels, {}),
            alerts: Array.isArray(alerts) ? alerts : String(alerts).split(' | ').filter(Boolean),
            tradingPlan: doc.tradingPlan || doc.aiTradingPlan || '',
            globalSnapshot: parseSafe(doc.globalSnapshot, {}),
            aiSentiment: doc.aiSentiment || null,
            aiOpportunities: doc.aiOpportunities ? String(doc.aiOpportunities).split(' | ') : [],
            aiRisks: doc.aiRisks ? String(doc.aiRisks).split(' | ') : [],
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
