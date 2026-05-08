import { NextRequest, NextResponse } from 'next/server';
import { generateSession, isKiteConfigured } from '@/lib/api/kite-connect';
import { firestoreSet } from '@/lib/firebase-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const requestToken = params.get('request_token');
    const status = params.get('status');

    if (status !== 'success' || !requestToken) {
        return NextResponse.redirect(new URL('/zerodha?error=login_failed', request.url));
    }

    if (!isKiteConfigured()) {
        return NextResponse.redirect(new URL('/zerodha?error=not_configured', request.url));
    }

    try {
        const session = await generateSession(requestToken);
        const accessToken = session.access_token;

        // Store in Firestore so it persists across serverless instances
        await firestoreSet('config', 'kite', {
            access_token: accessToken,
            user_name: session.user_name,
            user_id: session.user_id,
            updated_at: new Date().toISOString(),
        });

        // Also set in process.env for this request lifecycle
        process.env.KITE_ACCESS_TOKEN = accessToken;

        return NextResponse.redirect(new URL(`/zerodha?success=1&user=${encodeURIComponent(session.user_name)}`, request.url));
    } catch (e: any) {
        console.error('Kite callback error:', e);
        return NextResponse.redirect(new URL(`/zerodha?error=${encodeURIComponent(e.message)}`, request.url));
    }
}
