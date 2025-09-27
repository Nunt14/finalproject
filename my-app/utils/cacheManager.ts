import { ImageCache } from './imageCache';
import { DataCache } from './dataCache';
import { AggressiveCache } from './aggressiveCache';
import { CacheDashboard } from './cacheDashboard';

/**
 * Centralized cache management utility
 */
export class CacheManager {
  /**
   * Initialize cache management with aggressive optimization
   * Call this when app starts
   */
  static async initialize(): Promise<void> {
    try {
      // Clean expired caches on app start
      await Promise.all([
        ImageCache.cleanExpiredCache(),
        DataCache.cleanExpired(),
        // Aggressive cache cleanup is handled automatically
      ]);
      
      // Monitor cache performance
      const performance = await CacheDashboard.monitorPerformance();
      if (!performance.isHealthy) {
        console.warn('Cache performance issues detected:', performance.issues);
        console.log('Suggestions:', performance.suggestions);
      }
      
      console.log('🚀 Aggressive cache manager initialized');
    } catch (error) {
      console.error('Error initializing cache manager:', error);
    }
  }

  /**
   * Clear all caches (useful for logout or when user wants to refresh data)
   */
  static async clearAllCaches(): Promise<void> {
    try {
      await Promise.all([
        ImageCache.clearAllImageCache(),
        DataCache.clearAll(),
        AggressiveCache.clearAll(),
        CacheDashboard.clearAllCaches(),
      ]);
      
      console.log('🧹 All caches cleared (including aggressive cache)');
    } catch (error) {
      console.error('Error clearing all caches:', error);
    }
  }

  /**
   * Clear user-specific caches (useful when user data changes)
   */
  static async clearUserCaches(userId: string): Promise<void> {
    try {
      // Clear user profile cache
      await DataCache.clear(`user_profile_${userId}`);
      await DataCache.clear(`user_debts_${userId}`);
      await DataCache.clear(`user_trips_${userId}`);
      await DataCache.clear(`user_payments_${userId}`);
      await DataCache.clear(`user_notifications_${userId}`);
      
      console.log(`User caches cleared for user: ${userId}`);
    } catch (error) {
      console.error('Error clearing user caches:', error);
    }
  }

  /**
   * Get cache statistics (for debugging)
   */
  static async getCacheStats(): Promise<{
    imageCacheCount: number;
    dataCacheCount: number;
  }> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      const keys = await AsyncStorage.getAllKeys();
      
      const imageCacheCount = keys.filter(key => key.startsWith('cached_image_url_')).length;
      const dataCacheCount = keys.filter(key => key.startsWith('cached_data_')).length;
      
      return {
        imageCacheCount,
        dataCacheCount,
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { imageCacheCount: 0, dataCacheCount: 0 };
    }
  }

  /**
   * Clean up old caches (call periodically)
   */
  static async cleanup(): Promise<void> {
    try {
      await Promise.all([
        ImageCache.cleanExpiredCache(),
        DataCache.cleanExpired(),
      ]);
      
      console.log('Cache cleanup completed');
    } catch (error) {
      console.error('Error during cache cleanup:', error);
    }
  }
}
