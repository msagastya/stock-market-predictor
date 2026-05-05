import { NextRequest, NextResponse } from 'next/server';
import { cachedFetch } from '@/lib/api/cache-manager';
import { getYahooPeers, isYahooRateLimitError } from '@/lib/api/yahoo-finance';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    try {
        const peers = await cachedFetch(`peers-${symbol}`, async () => getYahooPeers(symbol), 30);
        return NextResponse.json({ peers });
    } catch (error) {
        console.error('Error fetching peers:', error);
        if (isYahooRateLimitError(error)) {
            return NextResponse.json({
                peers: [],
                warning: 'Yahoo Finance rate limited the peer comparison request.',
            });
        }

        return NextResponse.json({ error: 'Failed to fetch peers' }, { status: 500 });
    }
}
