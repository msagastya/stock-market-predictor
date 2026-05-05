// Redis client singleton — only created when REDIS_URL is set
import Redis from 'ioredis';

let client: Redis | null = null;

export function createClient(): Redis | null {
    if (typeof window !== 'undefined') return null; // browser — skip
    if (!process.env.REDIS_URL) return null;        // no Redis configured

    if (!client) {
        client = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: 2,
            connectTimeout: 3000,
            lazyConnect: true,
        });

        client.on('error', (err) => {
            console.warn('[Redis] connection error — falling back to memory cache:', err.message);
        });
    }

    return client;
}
