// Cache Manager — Redis when REDIS_URL is set, in-memory fallback otherwise
import { createClient } from './redis-client';

export interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

// ─── In-memory fallback ───────────────────────────────────────────────────────

class MemoryCache {
    private cache: Map<string, CacheEntry<any>> = new Map();

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }
        return entry.data as T;
    }

    set<T>(key: string, data: T, ttlMinutes: number = 5): void {
        this.cache.set(key, { data, timestamp: Date.now(), ttl: ttlMinutes * 60 * 1000 });
    }

    clear(key: string): void { this.cache.delete(key); }
    clearAll(): void { this.cache.clear(); }

    cleanExpired(): void {
        const now = Date.now();
        for (const [key, entry] of Array.from(this.cache.entries())) {
            if (now - entry.timestamp > entry.ttl) this.cache.delete(key);
        }
    }

    getStats(): { size: number; keys: string[] } {
        return { size: this.cache.size, keys: Array.from(this.cache.keys()) };
    }
}

// ─── Unified cache manager ────────────────────────────────────────────────────

class CacheManager {
    private memory = new MemoryCache();
    private redis = createClient(); // null when REDIS_URL is not set

    async get<T>(key: string): Promise<T | null> {
        if (this.redis) {
            try {
                const raw = await this.redis.get(key);
                if (raw) return JSON.parse(raw) as T;
                return null;
            } catch {
                // Redis unavailable — fall through to memory
            }
        }
        return this.memory.get<T>(key);
    }

    async set<T>(key: string, data: T, ttlMinutes: number = 5): Promise<void> {
        if (this.redis) {
            try {
                await this.redis.set(key, JSON.stringify(data), 'EX', ttlMinutes * 60);
                return;
            } catch {
                // Redis unavailable — fall through to memory
            }
        }
        this.memory.set(key, data, ttlMinutes);
    }

    async clear(key: string): Promise<void> {
        if (this.redis) {
            try { await this.redis.del(key); return; } catch { /* fall through */ }
        }
        this.memory.clear(key);
    }

    async clearAll(): Promise<void> {
        if (this.redis) {
            try { await this.redis.flushdb(); return; } catch { /* fall through */ }
        }
        this.memory.clearAll();
    }

    getStats() { return this.memory.getStats(); }
    cleanExpired() { this.memory.cleanExpired(); }
}

export const cacheManager = new CacheManager();

// In-memory cleanup (still useful as fallback)
if (typeof window === 'undefined') {
    setInterval(() => cacheManager.cleanExpired(), 10 * 60 * 1000);
}

export async function cachedFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlMinutes: number = 5
): Promise<T> {
    const cached = await cacheManager.get<T>(key);
    if (cached !== null) return cached;

    const data = await fetchFn();
    await cacheManager.set(key, data, ttlMinutes);
    return data;
}
