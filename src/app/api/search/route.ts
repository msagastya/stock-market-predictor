// API Route for stock search
import { NextRequest, NextResponse } from 'next/server';
import { searchMarketInstruments } from '@/lib/api/market-search';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.length < 1) {
        return NextResponse.json({ results: [] });
    }

    try {
        const results = await searchMarketInstruments(query);
        return NextResponse.json({ results });
    } catch (error) {
        console.error('Error searching stocks:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
