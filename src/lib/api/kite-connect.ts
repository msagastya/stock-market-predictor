import { Stock } from '@/types';
import { cachedFetch } from './cache-manager';

const KITE_API_KEY = process.env.KITE_API_KEY;
const KITE_ACCESS_TOKEN = process.env.KITE_ACCESS_TOKEN;
const KITE_INSTRUMENTS_URL = process.env.KITE_INSTRUMENTS_URL || 'https://api.kite.trade/instruments';

function hasKiteCredentials() {
  return Boolean(KITE_API_KEY && KITE_ACCESS_TOKEN);
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

export async function searchKiteInstruments(query: string, limit = 10): Promise<Stock[]> {
  if (!hasKiteCredentials() || query.trim().length < 2) {
    return [];
  }

  try {
    const csv = await cachedFetch('kite-instruments-dump', async () => {
      const response = await fetch(KITE_INSTRUMENTS_URL, {
        headers: {
          Authorization: `token ${KITE_API_KEY}:${KITE_ACCESS_TOKEN}`,
          'X-Kite-Version': '3',
        },
      });

      if (!response.ok) {
        throw new Error(`Kite instruments request failed with ${response.status}`);
      }

      return response.text();
    }, 60);

    const normalized = query.trim().toUpperCase();
    const lines = csv.split('\n').slice(1);
    const matches: Stock[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      const cols = parseCsvLine(line);
      const tradingsymbol = cols[2] || '';
      const name = cols[3] || tradingsymbol;
      const exchange = cols[11] || '';
      const segment = cols[10] || '';

      if (!['NSE', 'BSE', 'NFO', 'BFO'].includes(exchange)) {
        continue;
      }

      const haystack = `${tradingsymbol} ${name} ${exchange} ${segment}`.toUpperCase();
      if (!haystack.includes(normalized)) {
        continue;
      }

      matches.push({
        symbol: exchange === 'BSE' ? `${tradingsymbol}.BO` : `${tradingsymbol}.NS`,
        name: name || tradingsymbol,
        exchange,
        price: 0,
        change: 0,
        changePercent: 0,
        assetType: segment.includes('INDICES') ? 'index' : 'stock',
        provider: 'kite',
      });

      if (matches.length >= limit) break;
    }

    return matches;
  } catch (error) {
    console.error('Kite instrument search error:', error);
    return [];
  }
}
