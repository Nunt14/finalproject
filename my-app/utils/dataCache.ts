import AsyncStorage from '@react-native-async-storage/async-storage';

interface CachedData<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

const DEFAULT_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY_PREFIX = 'cached_data_';

/**
 * Cache API data locally to reduce Supabase requests
 */
export class DataCache {
  /**
   * Get cached data or return null if not cached/expired
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}${key}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      
      if (cached) {
        const cachedData: CachedData<T> = JSON.parse(cached);
        if (Date.now() < cachedData.expiresAt) {
          return cachedData.data;
        }
        // Cache expired, remove it
        await AsyncStorage.removeItem(cacheKey);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }

  /**
   * Set data in cache with expiration
   */
  static async set<T>(
    key: string, 
    data: T, 
    duration: number = DEFAULT_CACHE_DURATION
  ): Promise<void> {
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}${key}`;
      const cacheData: CachedData<T> = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + duration
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error setting cached data:', error);
    }
  }

  /**
   * Clear specific cache
   */
  static async clear(key: string): Promise<void> {
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}${key}`;
      await AsyncStorage.removeItem(cacheKey);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Clear all data caches
   */
  static async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const dataCacheKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));
      await AsyncStorage.multiRemove(dataCacheKeys);
    } catch (error) {
      console.error('Error clearing all data cache:', error);
    }
  }

  /**
   * Clean expired caches
   */
  static async cleanExpired(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const dataCacheKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));
      
      for (const key of dataCacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const cachedData: CachedData<any> = JSON.parse(cached);
          if (Date.now() >= cachedData.expiresAt) {
            await AsyncStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning expired data cache:', error);
    }
  }
}

/**
 * Cache keys for different data types
 */
export const CACHE_KEYS = {
  USER_PROFILE: 'user_profile',
  USER_DEBTS: 'user_debts',
  USER_TRIPS: 'user_trips',
  PAYMENT_PROOFS: 'payment_proofs',
  BILL_DETAILS: 'bill_details',
} as const;
