import { supabase } from '../constants/supabase';
import { AggressiveCache } from './aggressiveCache';

/**
 * Optimized Supabase service with aggressive caching
 * Minimizes Cached Egress usage
 */
export class OptimizedSupabase {
  /**
   * Get user profile with aggressive caching
   */
  static async getUserProfile(userId: string) {
    return AggressiveCache.getOrSet(
      `user_profile_${userId}`,
      async () => {
        const { data, error } = await supabase
          .from('user')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (error) throw error;
        return data;
      },
      24 * 60 * 60 * 1000 // 24 hours cache
    );
  }

  /**
   * Get user trips with aggressive caching
   */
  static async getUserTrips(userId: string) {
    return AggressiveCache.getOrSet(
      `user_trips_${userId}`,
      async () => {
        const { data, error } = await supabase
          .from('trip_member')
          .select(`
            trip_id,
            trip:trip_id (
              trip_id,
              trip_name,
              description,
              start_date,
              end_date,
              color,
              created_at
            )
          `)
          .eq('user_id', userId);
        
        if (error) throw error;
        return data;
      },
      12 * 60 * 60 * 1000 // 12 hours cache
    );
  }

  /**
   * Get trip details with aggressive caching
   */
  static async getTripDetails(tripId: string) {
    return AggressiveCache.getOrSet(
      `trip_details_${tripId}`,
      async () => {
        const { data, error } = await supabase
          .from('trip')
          .select(`
            *,
            trip_member (
              user_id,
              role,
              user:user_id (
                user_id,
                full_name,
                profile_image_url
              )
            )
          `)
          .eq('trip_id', tripId)
          .single();
        
        if (error) throw error;
        return data;
      },
      6 * 60 * 60 * 1000 // 6 hours cache
    );
  }

  /**
   * Get trip bills with aggressive caching
   */
  static async getTripBills(tripId: string) {
    return AggressiveCache.getOrSet(
      `trip_bills_${tripId}`,
      async () => {
        const { data, error } = await supabase
          .from('bill')
          .select(`
            *,
            paid_by_user:paid_by (
              user_id,
              full_name,
              profile_image_url
            ),
            bill_share (
              user_id,
              amount,
              is_paid,
              user:user_id (
                user_id,
                full_name,
                profile_image_url
              )
            )
          `)
          .eq('trip_id', tripId)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
      },
      2 * 60 * 60 * 1000 // 2 hours cache
    );
  }

  /**
   * Get user debts with aggressive caching
   */
  static async getUserDebts(userId: string) {
    return AggressiveCache.getOrSet(
      `user_debts_${userId}`,
      async () => {
        const { data, error } = await supabase
          .from('bill_share')
          .select(`
            *,
            bill (
              bill_id,
              title,
              amount,
              trip_id,
              paid_by,
              paid_by_user:paid_by (
                user_id,
                full_name,
                profile_image_url
              ),
              trip:trip_id (
                trip_id,
                trip_name
              )
            )
          `)
          .eq('user_id', userId)
          .eq('is_paid', false);
        
        if (error) throw error;
        return data;
      },
      1 * 60 * 60 * 1000 // 1 hour cache
    );
  }

  /**
   * Get payment proofs with aggressive caching
   */
  static async getPaymentProofs(userId: string) {
    return AggressiveCache.getOrSet(
      `payment_proofs_${userId}`,
      async () => {
        const { data, error } = await supabase
          .from('payment_proof')
          .select(`
            *,
            bill (
              bill_id,
              title,
              amount,
              trip:trip_id (
                trip_id,
                trip_name
              )
            ),
            creditor:creditor_id (
              user_id,
              full_name,
              profile_image_url
            )
          `)
          .eq('debtor_user_id', userId)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
      },
      30 * 60 * 1000 // 30 minutes cache
    );
  }

  /**
   * Get notifications with aggressive caching
   */
  static async getNotifications(userId: string) {
    return AggressiveCache.getOrSet(
      `notifications_${userId}`,
      async () => {
        const { data, error } = await supabase
          .from('notifications')
          .select(`
            *,
            sender:sender_id (
              user_id,
              full_name,
              profile_image_url
            ),
            trip:trip_id (
              trip_id,
              trip_name
            )
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (error) throw error;
        return data;
      },
      15 * 60 * 1000 // 15 minutes cache
    );
  }

  /**
   * Invalidate cache for specific user
   */
  static async invalidateUserCache(userId: string): Promise<void> {
    const keys = [
      `user_profile_${userId}`,
      `user_trips_${userId}`,
      `user_debts_${userId}`,
      `payment_proofs_${userId}`,
      `notifications_${userId}`,
    ];
    
    await Promise.all(keys.map(key => AggressiveCache.clear(key)));
  }

  /**
   * Invalidate cache for specific trip
   */
  static async invalidateTripCache(tripId: string): Promise<void> {
    const keys = [
      `trip_details_${tripId}`,
      `trip_bills_${tripId}`,
    ];
    
    await Promise.all(keys.map(key => AggressiveCache.clear(key)));
  }

  /**
   * Batch operations to reduce API calls
   */
  static async batchGetUserData(userId: string) {
    const [profile, trips, debts, notifications] = await Promise.all([
      this.getUserProfile(userId),
      this.getUserTrips(userId),
      this.getUserDebts(userId),
      this.getNotifications(userId),
    ]);
    
    return {
      profile,
      trips,
      debts,
      notifications,
    };
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats() {
    return AggressiveCache.getStats();
  }

  /**
   * Clear all caches
   */
  static async clearAllCaches() {
    await AggressiveCache.clearAll();
  }
}
