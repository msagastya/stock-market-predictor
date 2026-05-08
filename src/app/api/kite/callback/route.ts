import { NextRequest, NextResponse } from 'next/server';
import { generateSession, isKiteConfigured } from '@/lib/api/kite-connect';
import fs from 'fs';
import path from 'path';

// After login Zerodha redirects here with ?request_token=xxx&action=login&status=success
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

        // Persist access token into .env.local so it survives server restarts
        const envPath = path.join(process.cwd(), '.env.local');
        let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

        if (envContent.includes('KITE_ACCESS_TOKEN=')) {
            envContent = envContent.replace(/^KITE_ACCESS_TOKEN=.*/m, `KITE_ACCESS_TOKEN=${accessToken}`);
        } else {
            envContent += `\nKITE_ACCESS_TOKEN=${accessToken}\n`;
        }

        fs.writeFileSync(envPath, envContent);

        // Also set in process.env for the current process (no restart needed)
        process.env.KITE_ACCESS_TOKEN = accessToken;

        return NextResponse.redirect(new URL(`/zerodha?success=1&user=${encodeURIComponent(session.user_name)}`, request.url));
    } catch (e: any) {
        console.error('Kite callback error:', e);
        return NextResponse.redirect(new URL(`/zerodha?error=${encodeURIComponent(e.message)}`, request.url));
    }
}
