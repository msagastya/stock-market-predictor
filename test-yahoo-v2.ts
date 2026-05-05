
async function fetchWithHeaders(url: string) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
    };
    return fetch(url, { headers });
}

async function testYahooV2() {
    console.log('Testing Yahoo Finance API V2 (query2 + headers)...');
    const symbol = '^NSEI';
    const YAHOO_FINANCE_API = 'https://query2.finance.yahoo.com';

    try {
        // Test Quote
        const quoteUrl = `${YAHOO_FINANCE_API}/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
        console.log('Fetching Quote URL:', quoteUrl);

        const quoteResponse = await fetchWithHeaders(quoteUrl);

        if (!quoteResponse.ok) {
            console.error('Quote Request Failed:', quoteResponse.status, quoteResponse.statusText);
            const text = await quoteResponse.text();
            console.error('Response:', text);
        } else {
            const data = await quoteResponse.json();
            const quote = data.quoteResponse?.result?.[0];
            if (quote) {
                console.log('SUCCESS: Quote Data Received');
                console.log('Price:', quote.regularMarketPrice);
                console.log('Currency:', quote.currency);
            } else {
                console.error('FAILED: No quote data in response');
            }
        }

    } catch (error) {
        console.error('Test Failed:', error);
    }
}

testYahooV2();
