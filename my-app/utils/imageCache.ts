import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../constants/supabase';

interface CachedImageUrl {
  url: string;
  timestamp: number;
  expiresAt: number;
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_KEY_PREFIX = 'cached_image_url_';

/**
 * Cache image URL locally to reduce Supabase Cached Egress usage
 */
export class ImageCache {
  /**
   * Get cached image URL or fetch from Supabase if not cached/expired
   */
  static async getImageUrl(filePath: string): Promise<string | null> {
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}${filePath}`;
      
      // Check cache first
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const cachedData: CachedImageUrl = JSON.parse(cached);
        if (Date.now() < cachedData.expiresAt) {
          return cachedData.url;
        }
        // Cache expired, remove it
        await AsyncStorage.removeItem(cacheKey);
      }

      // Fetch from Supabase
      const { data } = await supabase.storage
        .from('payment-proofs')
        .getPublicUrl(filePath);

      if (data?.publicUrl) {
        // Cache the URL
        const cacheData: CachedImageUrl = {
          url: data.publicUrl,
          timestamp: Date.now(),
          expiresAt: Date.now() + CACHE_DURATION
        };
        await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
        return data.publicUrl;
      }

      return null;
    } catch (error) {
      console.error('Error getting cached image URL:', error);
      return null;
    }
  }

  /**
   * Clear specific image cache
   */
  static async clearImageCache(filePath: string): Promise<void> {
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}${filePath}`;
      await AsyncStorage.removeItem(cacheKey);
    } catch (error) {
      console.error('Error clearing image cache:', error);
    }
  }

  /**
   * Clear all image caches
   */
  static async clearAllImageCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const imageCacheKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));
      await AsyncStorage.multiRemove(imageCacheKeys);
    } catch (error) {
      console.error('Error clearing all image cache:', error);
    }
  }

  /**
   * Clean expired caches
   */
  static async cleanExpiredCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const imageCacheKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));
      
      for (const key of imageCacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const cachedData: CachedImageUrl = JSON.parse(cached);
          if (Date.now() >= cachedData.expiresAt) {
            await AsyncStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning expired cache:', error);
    }
  }
}
