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
        case '3mo':
            date.setDate(now.getDate() - 95);
            break;
        case '6mo':
            date.setDate(now.getDate() - 185);
            break;
        case '1y':
            date.setFullYear(now.getFullYear() - 1);
            date.setDate(date.getDate() - 5);
            break;
        case '5y':
            date.setFullYear(now.getFullYear() - 5);
            date.setDate(date.getDate() - 10);
            break;
        default:
            date.setFullYear(now.getFullYear() - 1);
    }
    return date;
}

function checkForDuplicates(data, useUnixTime) {
    const timestamps = data.map(d => useUnixTime ? Math.floor(new Date(d.date).getTime() / 1000) : new Date(d.date).toISOString().split('T')[0]);
    const uniqueTimestamps = new Set(timestamps);
    const duplicates = timestamps.length - uniqueTimestamps.size;
    return { total: timestamps.length, unique: uniqueTimestamps.size, duplicates };
}

function checkSorting(data, useUnixTime) {
    const timestamps = data.map(d => useUnixTime ? Math.floor(new Date(d.date).getTime() / 1000) : new Date(d.date).toISOString().split('T')[0]);
    for (let i = 1; i < timestamps.length; i++) {
        if (timestamps[i] < timestamps[i - 1]) {
            return false;
        }
    }
    return true;
}

async function testTimeframe(period, interval) {
    const intradayIntervals = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h'];
    const useUnixTime = intradayIntervals.includes(interval);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${period} with ${interval} interval`);
    console.log(`Timestamp format: ${useUnixTime ? 'Unix (seconds)' : 'Date string (YYYY-MM-DD)'}`);
    console.log(`${'='.repeat(60)}`);

    try {
        const startDate = calculateStartDate(period);
        console.log(`Start Date: ${startDate.toISOString()}`);

        const result = await yahooFinance.chart('^NSEI', {
            period1: startDate,
            interval: interval
        });

        if (result && result.quotes && result.quotes.length > 0) {
            const stats = checkForDuplicates(result.quotes, useUnixTime);
            const isSorted = checkSorting(result.quotes, useUnixTime);

            console.log(`✅ SUCCESS`);
            console.log(`   Total quotes: ${stats.total}`);
            console.log(`   Unique timestamps: ${stats.unique}`);
            console.log(`   Duplicates: ${stats.duplicates} ${stats.duplicates > 0 ? '⚠️  WARNING' : '✓'}`);
            console.log(`   Sorted correctly: ${isSorted ? 'Yes ✓' : 'No ⚠️'}`);
            console.log(`   First: ${result.quotes[0].date}`);
            console.log(`   Last: ${result.quotes[result.quotes.length - 1].date}`);

            if (stats.duplicates > 0 || !isSorted) {
                console.log(`   ⚠️  ISSUE DETECTED - This would cause chart errors!`);
            }
        } else {
            console.log(`⚠️  EMPTY RESULT`);
        }
    } catch (error) {
        console.error(`❌ ERROR: ${error.message}`);
        if (error.errors) console.error(JSON.stringify(error.errors, null, 2));
    }
}

async function runAllTests() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   COMPREHENSIVE TIMEFRAME TEST SUITE                       ║');
    console.log('║   Testing all timeframes for duplicate timestamps         ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    // Test all timeframes with appropriate intervals
    await testTimeframe('1d', '5m');    // Intraday - should use Unix timestamps
    await testTimeframe('5d', '15m');   // Intraday - should use Unix timestamps
    await testTimeframe('1mo', '1d');   // Daily - should use date strings
    await testTimeframe('3mo', '1d');   // Daily - should use date strings
    await testTimeframe('6mo', '1d');   // Daily - should use date strings
    await testTimeframe('1y', '1d');    // Daily - should use date strings
    await testTimeframe('5y', '1wk');   // Weekly - should use date strings

    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   TEST SUITE COMPLETE                                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\n');
}

runAllTests();
