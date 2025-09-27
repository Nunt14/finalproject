import { supabase } from '../constants/supabase';
import { AggressiveCache } from './aggressiveCache';

/**
 * Optimized image service to minimize Cached Egress
 */
export class OptimizedImageService {
  private static readonly IMAGE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Get image URL with aggressive caching
   */
  static async getImageUrl(filePath: string): Promise<string | null> {
    try {
      // Check cache first
      const cachedUrl = await AggressiveCache.get<string>(`image_url_${filePath}`);
      if (cachedUrl) {
        return cachedUrl;
      }

      // Fetch from Supabase if not cached
      const { data } = await supabase.storage
        .from('payment-proofs')
        .getPublicUrl(filePath);

      if (data?.publicUrl) {
        // Cache the URL for 7 days
        await AggressiveCache.set(`image_url_${filePath}`, data.publicUrl, this.IMAGE_CACHE_TTL);
        return data.publicUrl;
      }

      return null;
    } catch (error) {
      console.error('Error getting image URL:', error);
      return null;
    }
  }

  /**
   * Upload image with optimization
   */
  static async uploadImage(
    filePath: string,
    file: ArrayBuffer,
    options: {
      contentType: string;
      upsert?: boolean;
    }
  ): Promise<string | null> {
    try {
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, file, options);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      // Get public URL
      const { data } = await supabase.storage
        .from('payment-proofs')
        .getPublicUrl(filePath);

      if (data?.publicUrl) {
        // Cache the URL immediately
        await AggressiveCache.set(`image_url_${filePath}`, data.publicUrl, this.IMAGE_CACHE_TTL);
        return data.publicUrl;
      }

      return null;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  }

  /**
   * Batch get multiple image URLs
   */
  static async batchGetImageUrls(filePaths: string[]): Promise<Record<string, string | null>> {
    const results: Record<string, string | null> = {};
    
    // Get all cached URLs first
    const cachedResults = await Promise.all(
      filePaths.map(async (path) => ({
        path,
        url: await AggressiveCache.get<string>(`image_url_${path}`)
      }))
    );

    // Add cached results
    cachedResults.forEach(({ path, url }) => {
      results[path] = url;
    });

    // Get uncached URLs
    const uncachedPaths = filePaths.filter(path => !results[path]);
    
    if (uncachedPaths.length > 0) {
      const uncachedResults = await Promise.all(
        uncachedPaths.map(async (path) => {
          const url = await this.getImageUrl(path);
          return { path, url };
        })
      );

      // Add uncached results
      uncachedResults.forEach(({ path, url }) => {
        results[path] = url;
      });
    }

    return results;
  }

  /**
   * Clear image cache
   */
  static async clearImageCache(filePath?: string): Promise<void> {
    if (filePath) {
      await AggressiveCache.clear(`image_url_${filePath}`);
    } else {
      // Clear all image caches
      const keys = await AggressiveCache.getStats();
      // This would need to be implemented in AggressiveCache
      console.log('Clearing all image caches...');
    }
  }

  /**
   * Get image cache statistics
   */
  static async getImageCacheStats(): Promise<{
    totalImages: number;
    cacheHitRate: number;
  }> {
    const stats = await AggressiveCache.getStats();
    return {
      totalImages: stats.totalEntries,
      cacheHitRate: stats.hitRate,
    };
  }
}
