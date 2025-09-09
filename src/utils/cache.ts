/**
 * Simple Cache Implementation
 */

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export class Cache {
  private store: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 300; // 5 minutes

  set<T>(key: string, value: T, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTTL) * 1000;
    this.store.set(key, { value, expiry });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    // Clean expired entries first
    this.cleanExpired();
    return this.store.size;
  }

  private cleanExpired(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiry) {
        this.store.delete(key);
      }
    }
  }
}