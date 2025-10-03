import { ImageCache } from './imageCache';
import { DataCache } from './dataCache';
import { AggressiveCache } from './aggressiveCache';
import { CacheDashboard } from './cacheDashboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    aggressiveCacheCount: number;
    totalSize: number;
    hitRate: number;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      
      const imageCacheCount = keys.filter(key => key.startsWith('cached_image_url_')).length;
      const dataCacheCount = keys.filter(key => key.startsWith('cached_data_')).length;
      const aggressiveCacheCount = keys.filter(key => key.startsWith('aggressive_cache_')).length;
      
      // Calculate total size
      let totalSize = 0;
      let totalAccesses = 0;
      
      for (const key of keys) {
        if (key.startsWith('cached_') || key.startsWith('aggressive_cache_')) {
          const cached = await AsyncStorage.getItem(key);
          if (cached) {
            totalSize += cached.length;
            try {
              const entry = JSON.parse(cached);
              if (entry.accessCount) {
                totalAccesses += entry.accessCount;
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
      }
      
      const totalCacheCount = imageCacheCount + dataCacheCount + aggressiveCacheCount;
      const hitRate = totalCacheCount > 0 ? totalAccesses / totalCacheCount : 0;
      
      return {
        imageCacheCount,
        dataCacheCount,
        aggressiveCacheCount,
        totalSize,
        hitRate,
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { 
        imageCacheCount: 0, 
        dataCacheCount: 0, 
        aggressiveCacheCount: 0,
        totalSize: 0,
        hitRate: 0
      };
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

  /**
   * Log detailed cache usage statistics
   */
  static async logCacheUsage(): Promise<void> {
    try {
      const stats = await this.getCacheStats();
      const sizeInKB = Math.round(stats.totalSize / 1024);
      const sizeInMB = Math.round(stats.totalSize / (1024 * 1024) * 100) / 100;
      
      console.log('📊 ===== CACHE USAGE REPORT =====');
      console.log(`🖼️  Image Cache: ${stats.imageCacheCount} entries`);
      console.log(`📊 Data Cache: ${stats.dataCacheCount} entries`);
      console.log(`⚡ Aggressive Cache: ${stats.aggressiveCacheCount} entries`);
      console.log(`📦 Total Entries: ${stats.imageCacheCount + stats.dataCacheCount + stats.aggressiveCacheCount}`);
      console.log(`💾 Total Size: ${sizeInKB} KB (${sizeInMB} MB)`);
      console.log(`🎯 Hit Rate: ${Math.round(stats.hitRate * 100)}%`);
      console.log('================================');
      
      // Log cache efficiency
      if (stats.hitRate > 0.7) {
        console.log('✅ Cache efficiency: EXCELLENT');
      } else if (stats.hitRate > 0.4) {
        console.log('⚠️  Cache efficiency: GOOD');
      } else {
        console.log('❌ Cache efficiency: NEEDS IMPROVEMENT');
      }
      
      // Log storage usage
      if (stats.totalSize > 10 * 1024 * 1024) { // 10MB
        console.log('⚠️  Cache size is large (>10MB), consider cleanup');
      } else if (stats.totalSize > 5 * 1024 * 1024) { // 5MB
        console.log('ℹ️  Cache size is moderate (5-10MB)');
      } else {
        console.log('✅ Cache size is optimal (<5MB)');
      }
      
    } catch (error) {
      console.error('Error logging cache usage:', error);
    }
  }

  /**
   * Log cache performance metrics
   */
  static async logCachePerformance(): Promise<void> {
    try {
      const performance = await CacheDashboard.monitorPerformance();
      
      console.log('🚀 ===== CACHE PERFORMANCE =====');
      console.log(`📈 Performance Score: ${performance.score}/100`);
      console.log(`⏱️  Average Response Time: ${performance.avgResponseTime}ms`);
      console.log(`💾 Memory Usage: ${performance.memoryUsage}MB`);
      console.log(`🔄 Cache Hit Rate: ${performance.hitRate}%`);
      console.log(`🧹 Cleanup Frequency: ${performance.cleanupFrequency}`);
      
      if (performance.issues.length > 0) {
        console.log('⚠️  Issues detected:');
        performance.issues.forEach((issue, index) => {
          console.log(`   ${index + 1}. ${issue}`);
        });
      }
      
      if (performance.suggestions.length > 0) {
        console.log('💡 Suggestions:');
        performance.suggestions.forEach((suggestion, index) => {
          console.log(`   ${index + 1}. ${suggestion}`);
        });
      }
      
      console.log('================================');
      
    } catch (error) {
      console.error('Error logging cache performance:', error);
    }
  }
}
