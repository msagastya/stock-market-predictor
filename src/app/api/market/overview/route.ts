import { NextResponse } from 'next/server';
import { cachedFetch } from '@/lib/api/cache-manager';
import { getYahooBatchQuotes, getYahooDailyGainers, getYahooTrendingQuotes } from '@/lib/api/yahoo-finance';
import { getFallbackBatchQuotes } from '@/lib/api/fallback-market-data';
import { getNSEAllIndices, getNSETopGainers, getNSETopLosers, initNSESession } from '@/lib/api/nse-india';
import { getBSESensex, getBSETopGainers, getBSETopLosers } from '@/lib/api/bse-india';

export const dynamic = 'force-dynamic';

const INDIA_INDEX_SYMBOLS = ['^NSEI', '^NSEBANK', '^BSESN', 'NIFTY_FIN_SERVICE.NS'];
const GLOBAL_INDEX_SYMBOLS = ['^GSPC', '^DJI', '^IXIC', '^FTSE', '^N225', '^HSI'];
const INDIA_LEADER_SYMBOLS = ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS'];

// Map NSE index names to display names
const NSE_INDEX_DISPLAY: Record<string, string> = {
    'NIFTY 50': 'Nifty 50',
    'NIFTY BANK': 'Nifty Bank',
    'NIFTY IT': 'Nifty IT',
    'NIFTY NEXT 50': 'Nifty Next 50',
    'NIFTY MIDCAP 100': 'Nifty Midcap 100',
    'NIFTY SMALLCAP 100': 'Nifty Smallcap 100',
    'NIFTY AUTO': 'Nifty Auto',
    'NIFTY PHARMA': 'Nifty Pharma',
    'NIFTY FMCG': 'Nifty FMCG',
    'NIFTY METAL': 'Nifty Metal',
    'NIFTY REALTY': 'Nifty Realty',
    'NIFTY ENERGY': 'Nifty Energy',
    'INDIA VIX': 'India VIX',
};

const IMPORTANT_INDICES = ['NIFTY 50', 'NIFTY BANK', 'NIFTY IT', 'NIFTY MIDCAP 100', 'NIFTY SMALLCAP 100', 'INDIA VIX'];

export async function GET() {
    try {
        const overview = await cachedFetch('market-overview', async () => {
            // Warm NSE session first so all parallel calls share the same cookie
            await initNSESession();

            // Fetch from multiple sources in parallel
            const [nseIndicesResult, bseSensexResult, nseGainersResult, nseLosersResult,
                bseGainersResult, bseLosersResult, globalIndicesResult, trendingResult] = await Promise.allSettled([
                getNSEAllIndices(),
                getBSESensex(),
                getNSETopGainers('NIFTY'),
                getNSETopLosers('NIFTY'),
                getBSETopGainers(),
                getBSETopLosers(),
                getYahooBatchQuotes(GLOBAL_INDEX_SYMBOLS),
                getYahooTrendingQuotes('IN', 5),
            ]);

            // Build India indices from NSE data
            let indiaIndices: any[] = [];
            if (nseIndicesResult.status === 'fulfilled' && nseIndicesResult.value.length > 0) {
                const filtered = nseIndicesResult.value.filter(i => IMPORTANT_INDICES.includes(i.name));
                indiaIndices = filtered.map(i => ({
                    symbol: '^' + i.name.replace(/ /g, ''),
                    name: NSE_INDEX_DISPLAY[i.name] || i.name,
                    price: i.value,
                    change: i.change,
                    changePercent: i.changePercent,
                    currency: 'INR',
                    region: 'India',
                    source: 'nse',
                    advances: i.advances,
                    declines: i.declines,
                    open: i.open,
                    dayHigh: i.high,
                    dayLow: i.low,
                    previousClose: i.prevClose,
                    fiftyTwoWeekHigh: i.yearHigh,
                    fiftyTwoWeekLow: i.yearLow,
                }));
            }

            // Add Sensex from BSE
            if (bseSensexResult.status === 'fulfilled' && bseSensexResult.value) {
                const s = bseSensexResult.value;
                indiaIndices.push({
                    symbol: '^BSESN',
                    name: 'Sensex',
                    price: s.value,
                    change: s.change,
                    changePercent: s.changePercent,
                    currency: 'INR',
                    region: 'India',
                    source: 'bse',
                });
            }

            // Use Yahoo fallback for India indices if NSE failed
            if (indiaIndices.length === 0) {
                try {
                    const yahooIndia = await getYahooBatchQuotes(INDIA_INDEX_SYMBOLS);
                    indiaIndices = yahooIndia.map(q => ({ ...q, region: 'India', source: 'yahoo' }));
                } catch {
                    indiaIndices = getFallbackBatchQuotes(INDIA_INDEX_SYMBOLS).map(q => ({ ...q, region: 'India', source: 'synthetic' }));
                }
            }

            // Build top movers — prefer NSE, fall back to BSE, then Yahoo
            let topGainers: any[] = [];
            let topLosers: any[] = [];

            if (nseGainersResult.status === 'fulfilled' && nseGainersResult.value.length > 0) {
                topGainers = nseGainersResult.value.map(q => ({ ...q, source: 'nse' }));
            } else if (bseGainersResult.status === 'fulfilled' && bseGainersResult.value.length > 0) {
                topGainers = bseGainersResult.value.map(q => ({ ...q, source: 'bse' }));
            } else {
                try {
                    topGainers = (await getYahooDailyGainers(10)).map(q => ({ ...q, source: 'yahoo' }));
                } catch { /* skip */ }
            }

            if (nseLosersResult.status === 'fulfilled' && nseLosersResult.value.length > 0) {
                topLosers = nseLosersResult.value.map(q => ({ ...q, source: 'nse' }));
            } else if (bseLosersResult.status === 'fulfilled' && bseLosersResult.value.length > 0) {
                topLosers = bseLosersResult.value.map(q => ({ ...q, source: 'bse' }));
            }

            const globalIndices = globalIndicesResult.status === 'fulfilled'
                ? globalIndicesResult.value.map(q => ({ ...q, region: 'Global', source: 'yahoo' }))
                : getFallbackBatchQuotes(GLOBAL_INDEX_SYMBOLS).map(q => ({ ...q, region: 'Global', source: 'synthetic' }));

            const trendingIndia = trendingResult.status === 'fulfilled'
                ? trendingResult.value
                : getFallbackBatchQuotes(INDIA_LEADER_SYMBOLS.slice(0, 5));

            // India leaders for the dashboard cards
            let indiaLeaders: any[] = [];
            try {
                const yahooLeaders = await getYahooBatchQuotes(INDIA_LEADER_SYMBOLS);
                indiaLeaders = yahooLeaders.map(q => ({ ...q, region: 'India', source: 'yahoo' }));
            } catch {
                indiaLeaders = getFallbackBatchQuotes(INDIA_LEADER_SYMBOLS).map(q => ({ ...q, region: 'India', source: 'synthetic' }));
            }

            return { indiaIndices, globalIndices, trendingIndia, indiaLeaders, topGainers, topLosers };
        }, 5);

        return NextResponse.json(overview);
    } catch (error) {
        console.error('Market overview error:', error);
        return NextResponse.json({
            indiaIndices: getFallbackBatchQuotes(INDIA_INDEX_SYMBOLS).map(q => ({ ...q, region: 'India' })),
            globalIndices: getFallbackBatchQuotes(GLOBAL_INDEX_SYMBOLS).map(q => ({ ...q, region: 'Global' })),
            trendingIndia: getFallbackBatchQuotes(INDIA_LEADER_SYMBOLS.slice(0, 5)),
            indiaLeaders: getFallbackBatchQuotes(INDIA_LEADER_SYMBOLS).map(q => ({ ...q, region: 'India' })),
            topGainers: [],
            topLosers: [],
            warning: 'Live overview unavailable. Showing fallback data.',
        });
    }
}
