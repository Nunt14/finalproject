import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
}

/**
 * Aggressive caching system to minimize Supabase Cached Egress
 */
export class AggressiveCache {
  private static readonly CACHE_PREFIX = 'aggressive_cache_';
  private static readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly MAX_CACHE_SIZE = 50; // Maximum number of cache entries

  /**
   * Get data from cache with aggressive caching
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${key}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      
      if (!cached) return null;
      
      const entry: CacheEntry<T> = JSON.parse(cached);
      
      // Check if expired
      if (Date.now() > entry.expiresAt) {
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }
      
      // Update access statistics
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
      
      return entry.data;
    } catch (error) {
      console.error('Error getting from aggressive cache:', error);
      return null;
    }
  }

  /**
   * Set data in cache with aggressive TTL
   */
  static async set<T>(
    key: string, 
    data: T, 
    ttl: number = this.DEFAULT_TTL
  ): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${key}`;
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttl,
        accessCount: 0,
        lastAccessed: Date.now(),
      };
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
      
      // Clean up old entries if cache is too large
      await this.cleanupIfNeeded();
    } catch (error) {
      console.error('Error setting aggressive cache:', error);
    }
  }

  /**
   * Get or set pattern - only fetch if not cached
   */
  static async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    const data = await fetchFn();
    await this.set(key, data, ttl);
    return data;
  }

  /**
   * Clear specific cache entry
   */
  static async clear(key: string): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${key}`;
      await AsyncStorage.removeItem(cacheKey);
    } catch (error) {
      console.error('Error clearing aggressive cache:', error);
    }
  }

  /**
   * Clear all cache entries
   */
  static async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Error clearing all aggressive cache:', error);
    }
  }

  /**
   * Clean up old or least used entries
   */
  private static async cleanupIfNeeded(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      if (cacheKeys.length <= this.MAX_CACHE_SIZE) return;
      
      // Get all cache entries with metadata
      const entries: Array<{ key: string; entry: CacheEntry<any> }> = [];
      
      for (const key of cacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const entry: CacheEntry<any> = JSON.parse(cached);
          entries.push({ key, entry });
        }
      }
      
      // Sort by last accessed (oldest first)
      entries.sort((a, b) => a.entry.lastAccessed - b.entry.lastAccessed);
      
      // Remove oldest entries
      const toRemove = entries.slice(0, entries.length - this.MAX_CACHE_SIZE);
      const keysToRemove = toRemove.map(item => item.key);
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`🧹 Cleaned up ${keysToRemove.length} old cache entries`);
      }
    } catch (error) {
      console.error('Error cleaning up aggressive cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  static async getStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    hitRate: number;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      let totalSize = 0;
      let totalAccesses = 0;
      
      for (const key of cacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          totalSize += cached.length;
          const entry: CacheEntry<any> = JSON.parse(cached);
          totalAccesses += entry.accessCount;
        }
      }
      
      return {
        totalEntries: cacheKeys.length,
        totalSize,
        hitRate: totalAccesses / Math.max(cacheKeys.length, 1),
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { totalEntries: 0, totalSize: 0, hitRate: 0 };
    }
  }
}
