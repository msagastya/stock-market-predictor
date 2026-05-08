import { NextResponse } from 'next/server';
import { getHoldings, getPositions, getKiteMargins, hasKiteCredentials } from '@/lib/api/kite-connect';

export async function GET() {
    if (!hasKiteCredentials()) {
        return NextResponse.json({ error: 'Kite not authenticated' }, { status: 401 });
    }
    try {
        const [holdings, positions, margins] = await Promise.allSettled([
            getHoldings(),
            getPositions(),
            getKiteMargins(),
        ]);

        return NextResponse.json({
            holdings: holdings.status === 'fulfilled' ? holdings.value : [],
            positions: positions.status === 'fulfilled' ? positions.value : { net: [], day: [] },
            margins: margins.status === 'fulfilled' ? margins.value : null,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
