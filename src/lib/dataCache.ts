type Entry<T> = {
  data: T;
  storedAt: number;
};

class DataCache {
  private entries = new Map<string, Entry<unknown>>();

  /**
   * Store a value in the cache, stamping it with the current time.
   */
  set<T>(key: string, data: T): void {
    this.entries.set(key, { data, storedAt: Date.now() });
  }

  /**
   * Returns the cached value only if it was stored within `maxAgeMs`.
   * Returns null if missing or expired.
   */
  getFresh<T>(key: string, maxAgeMs: number): T | null {
    const entry = this.entries.get(key) as Entry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.storedAt > maxAgeMs) return null;
    return entry.data;
  }

  /**
   * Returns the cached value regardless of age.
   * Returns null only if the key has never been stored.
   */
  getStale<T>(key: string): T | null {
    const entry = this.entries.get(key) as Entry<T> | undefined;
    return entry !== undefined ? (entry.data as T) : null;
  }

  /**
   * Marks a key as expired without removing it, so `getStale` still works
   * but `getFresh` will return null. Used to force background re-fetch on
   * the next hook mount while keeping stale data visible.
   */
  expire(key: string): void {
    const entry = this.entries.get(key);
    if (entry) {
      this.entries.set(key, { ...entry, storedAt: 0 });
    }
  }

  /**
   * Removes a key entirely (use for hard refresh / error recovery).
   */
  delete(key: string): void {
    this.entries.delete(key);
  }
}

/**
 * Module-level singleton: lives for the whole app session.
 * Data survives navigation (screen mounts/unmounts) but not app restarts.
 */
export const dataCache = new DataCache();
