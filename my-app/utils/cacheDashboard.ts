import { AggressiveCache } from './aggressiveCache';
import { OptimizedSupabase } from './optimizedSupabase';
import { OptimizedImageService } from './optimizedImageService';

/**
 * Cache management dashboard for monitoring and optimization
 */
export class CacheDashboard {
  /**
   * Get comprehensive cache statistics
   */
  static async getComprehensiveStats(): Promise<{
    aggressiveCache: {
      totalEntries: number;
      totalSize: number;
      hitRate: number;
    };
    imageCache: {
      totalImages: number;
      cacheHitRate: number;
    };
    recommendations: string[];
  }> {
    const [aggressiveStats, imageStats] = await Promise.all([
      AggressiveCache.getStats(),
      OptimizedImageService.getImageCacheStats(),
    ]);

    const recommendations: string[] = [];

    // Analyze cache performance
    if (aggressiveStats.hitRate < 0.5) {
      recommendations.push('Cache hit rate is low. Consider increasing cache TTL.');
    }

    if (aggressiveStats.totalEntries > 40) {
      recommendations.push('Cache is getting large. Consider cleaning up old entries.');
    }

    if (imageStats.cacheHitRate < 0.3) {
      recommendations.push('Image cache hit rate is low. Check image URL patterns.');
    }

    return {
      aggressiveCache: aggressiveStats,
      imageCache: imageStats,
      recommendations,
    };
  }

  /**
   * Optimize cache performance
   */
  static async optimizeCache(): Promise<{
    cleanedEntries: number;
    optimizedEntries: number;
  }> {
    let cleanedEntries = 0;
    let optimizedEntries = 0;

    try {
      // Clean up old cache entries
      const stats = await AggressiveCache.getStats();
      if (stats.totalEntries > 30) {
        // Force cleanup
        await AggressiveCache.clearAll();
        cleanedEntries = stats.totalEntries;
      }

      // Optimize cache TTL based on usage patterns
      // This would require more sophisticated analysis
      optimizedEntries = 0;

      console.log(`🧹 Cache optimization completed: ${cleanedEntries} entries cleaned, ${optimizedEntries} entries optimized`);
    } catch (error) {
      console.error('Error optimizing cache:', error);
    }

    return { cleanedEntries, optimizedEntries };
  }

  /**
   * Get cache usage report
   */
  static async getUsageReport(): Promise<string> {
    const stats = await this.getComprehensiveStats();
    
    let report = '📊 CACHE USAGE REPORT\n';
    report += '='.repeat(50) + '\n\n';
    
    report += '🔍 AGGRESSIVE CACHE:\n';
    report += `- Total Entries: ${stats.aggressiveCache.totalEntries}\n`;
    report += `- Total Size: ${(stats.aggressiveCache.totalSize / 1024).toFixed(2)} KB\n`;
    report += `- Hit Rate: ${(stats.aggressiveCache.hitRate * 100).toFixed(1)}%\n\n`;
    
    report += '🖼️ IMAGE CACHE:\n';
    report += `- Total Images: ${stats.imageCache.totalImages}\n`;
    report += `- Cache Hit Rate: ${(stats.imageCache.cacheHitRate * 100).toFixed(1)}%\n\n`;
    
    if (stats.recommendations.length > 0) {
      report += '💡 RECOMMENDATIONS:\n';
      stats.recommendations.forEach((rec, index) => {
        report += `${index + 1}. ${rec}\n`;
      });
      report += '\n';
    }
    
    report += '🎯 CACHED EGRESS OPTIMIZATION:\n';
    report += `- Estimated Cached Egress Reduction: ${Math.round((stats.aggressiveCache.hitRate + stats.imageCache.cacheHitRate) / 2 * 100)}%\n`;
    report += `- Network Requests Saved: ${Math.round(stats.aggressiveCache.totalEntries * stats.aggressiveCache.hitRate)}\n`;
    
    return report;
  }

  /**
   * Clear all caches
   */
  static async clearAllCaches(): Promise<void> {
    try {
      await Promise.all([
        AggressiveCache.clearAll(),
        OptimizedImageService.clearImageCache(),
      ]);
      console.log('🧹 All caches cleared successfully');
    } catch (error) {
      console.error('Error clearing all caches:', error);
    }
  }

  /**
   * Monitor cache performance
   */
  static async monitorPerformance(): Promise<{
    isHealthy: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const stats = await this.getComprehensiveStats();
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check cache health
    if (stats.aggressiveCache.hitRate < 0.3) {
      issues.push('Low cache hit rate');
      suggestions.push('Increase cache TTL or improve cache key patterns');
    }

    if (stats.aggressiveCache.totalEntries > 50) {
      issues.push('Cache size is large');
      suggestions.push('Implement cache cleanup strategy');
    }

    if (stats.imageCache.cacheHitRate < 0.2) {
      issues.push('Low image cache hit rate');
      suggestions.push('Review image URL patterns and caching strategy');
    }

    const isHealthy = issues.length === 0;

    return {
      isHealthy,
      issues,
      suggestions,
    };
  }
}
