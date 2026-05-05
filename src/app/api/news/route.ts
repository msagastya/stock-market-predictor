import { NextRequest, NextResponse } from 'next/server';
import { cachedFetch } from '@/lib/api/cache-manager';
import { getYahooNews, isYahooRateLimitError } from '@/lib/api/yahoo-finance';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const name = searchParams.get('name');

    if (!symbol && !name) {
        return NextResponse.json({ error: 'Symbol or name is required' }, { status: 400 });
    }

    try {
        const query = symbol || name || '';
        const cacheKey = `news-${query}`;
        const news = await cachedFetch(cacheKey, async () => getYahooNews(query, 8), 10);

        return NextResponse.json({ news });
    } catch (error) {
        console.error('Error fetching news:', error);
        if (isYahooRateLimitError(error)) {
            return NextResponse.json({
                news: [],
                warning: 'Yahoo Finance rate limited the news request.',
            });
        }

        return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
    }
}
