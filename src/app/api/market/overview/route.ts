import { NextResponse } from 'next/server';
import { cachedFetch } from '@/lib/api/cache-manager';
import { getYahooBatchQuotes, getYahooDailyGainers, getYahooTrendingQuotes } from '@/lib/api/yahoo-finance';
import { getFallbackBatchQuotes } from '@/lib/api/fallback-market-data';

export const dynamic = 'force-dynamic';

const INDIA_INDEX_SYMBOLS = ['^NSEI', '^NSEBANK', '^BSESN', 'NIFTY_FIN_SERVICE.NS'];
const GLOBAL_INDEX_SYMBOLS = ['^GSPC', '^DJI', '^IXIC', '^FTSE', '^N225', '^HSI'];
const INDIA_LEADER_SYMBOLS = ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS'];

export async function GET() {
    try {
        const overview = await cachedFetch('market-overview', async () => {
            const [indiaIndicesResult, globalIndicesResult, trendingResult, indiaLeadersResult, gainersResult] = await Promise.allSettled([
                getYahooBatchQuotes(INDIA_INDEX_SYMBOLS),
                getYahooBatchQuotes(GLOBAL_INDEX_SYMBOLS),
                getYahooTrendingQuotes('IN', 5),
                getYahooBatchQuotes(INDIA_LEADER_SYMBOLS),
                getYahooDailyGainers(5),
            ]);

            return {
                indiaIndices: indiaIndicesResult.status === 'fulfilled'
                    ? indiaIndicesResult.value.map((item) => ({ ...item, region: 'India' }))
                    : [],
                globalIndices: globalIndicesResult.status === 'fulfilled'
                    ? globalIndicesResult.value.map((item) => ({ ...item, region: 'Global' }))
                    : [],
                trendingIndia: trendingResult.status === 'fulfilled' ? trendingResult.value : [],
                indiaLeaders: indiaLeadersResult.status === 'fulfilled'
                    ? indiaLeadersResult.value.map((item) => ({ ...item, region: 'India' }))
                    : [],
                topGainers: gainersResult.status === 'fulfilled' ? gainersResult.value : [],
            };
        }, 5);

        return NextResponse.json(overview);
    } catch (error) {
        console.error('Error fetching market overview:', error);
        return NextResponse.json({
            indiaIndices: getFallbackBatchQuotes(INDIA_INDEX_SYMBOLS),
            globalIndices: getFallbackBatchQuotes(GLOBAL_INDEX_SYMBOLS),
            trendingIndia: getFallbackBatchQuotes(INDIA_LEADER_SYMBOLS.slice(0, 5)),
            indiaLeaders: getFallbackBatchQuotes(INDIA_LEADER_SYMBOLS),
            topGainers: getFallbackBatchQuotes(['^GSPC', '^IXIC', 'RELIANCE.NS', 'TCS.NS', 'SBIN.NS']),
            warning: 'Live overview is unavailable. Showing fallback market data.',
        }, { status: 200 });
    }
}
