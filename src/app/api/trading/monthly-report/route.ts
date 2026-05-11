import { NextResponse } from 'next/server';
import { firestoreGet } from '@/lib/firebase-store';
import { analyzeMonth } from '@/lib/trading/monthly-analyzer';
import { PaperTrade, DailySummary } from '@/lib/trading/paper-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
    try {
        // Pull last 30 days of trade data
        const allTrades: PaperTrade[]    = [];
        const allSummaries: DailySummary[] = [];
        const today = new Date();

        for (let i = 0; i < 30; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

            const [tradesDoc, summaryDoc] = await Promise.all([
                firestoreGet('paper_trading', `trades_${dateStr}`),
                firestoreGet('paper_trading', `summary_${dateStr}`),
            ]);

            if (tradesDoc?.trades) {
                const trades: PaperTrade[] = JSON.parse(tradesDoc.trades);
                allTrades.push(...trades);
            }

            if (summaryDoc?.date) {
                allSummaries.push({
                    ...summaryDoc,
                    patternsSeen:    JSON.parse(summaryDoc.patternsSeen    || '[]'),
                    recommendations: JSON.parse(summaryDoc.recommendations || '[]'),
                    bestTrade:       summaryDoc.bestTrade  ? JSON.parse(summaryDoc.bestTrade)  : null,
                    worstTrade:      summaryDoc.worstTrade ? JSON.parse(summaryDoc.worstTrade) : null,
                } as DailySummary);
            }
        }

        const report = analyzeMonth(allTrades, allSummaries);
        return NextResponse.json(report);

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
