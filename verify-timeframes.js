const yahooFinance = require('yahoo-finance2').default;

function calculateStartDate(period) {
    const now = new Date();
    const date = new Date(now);

    switch (period) {
        case '1d':
            date.setDate(now.getDate() - 3);
            break;
        case '5d':
            date.setDate(now.getDate() - 8);
            break;
        case '1mo':
            date.setDate(now.getDate() - 35);
            break;
        case '1y':
            date.setFullYear(now.getFullYear() - 1);
            date.setDate(date.getDate() - 5);
            break;
        default:
            date.setFullYear(now.getFullYear() - 1);
    }
    return date;
}

async function testTimeframe(period, interval) {
    console.log(`Testing ${period} with interval ${interval}...`);
    try {
        const startDate = calculateStartDate(period);
        console.log(`  Start Date: ${startDate.toISOString()}`);

        const result = await yahooFinance.chart('^NSEI', {
            period1: startDate,
            interval: interval
        });

        if (result && result.quotes && result.quotes.length > 0) {
            console.log(`  ✅ Success! Got ${result.quotes.length} quotes.`);
            console.log(`  First: ${JSON.stringify(result.quotes[0].date)}`);
            console.log(`  Last: ${JSON.stringify(result.quotes[result.quotes.length - 1].date)}`);
        } else {
            console.log(`  ⚠️ Empty result.`);
        }
    } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        if (error.errors) console.error(JSON.stringify(error.errors, null, 2));
    }
    console.log('---');
}

async function run() {
    await testTimeframe('1d', '5m');
    await testTimeframe('5d', '15m');
    await testTimeframe('1mo', '1d');
    await testTimeframe('1y', '1d');
}

run();
