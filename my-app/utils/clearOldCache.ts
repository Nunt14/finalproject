import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Clear old cache data from previous database
 * Run this once when switching to new database
 */
export async function clearOldCache(): Promise<void> {
  try {
    console.log('🧹 Clearing old cache data...');
    
    // Clear all AsyncStorage data
    await AsyncStorage.clear();
    
    console.log('✅ Old cache cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing old cache:', error);
  }
}

/**
 * Clear specific old cache keys
 */
export async function clearSpecificOldCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    
    // Clear old Supabase auth tokens
    const oldAuthKeys = keys.filter(key => 
      key.includes('sb-kiwketmokykkyotpwdmm') || 
      key.includes('sb-kiwketmokykkyotpwdmm')
    );
    
    if (oldAuthKeys.length > 0) {
      await AsyncStorage.multiRemove(oldAuthKeys);
      console.log(`🗑️ Removed ${oldAuthKeys.length} old auth keys`);
    }
    
    // Clear old cache data
    const oldCacheKeys = keys.filter(key => 
      key.startsWith('cached_') || 
      key.startsWith('sb-')
    );
    
    if (oldCacheKeys.length > 0) {
      await AsyncStorage.multiRemove(oldCacheKeys);
      console.log(`🗑️ Removed ${oldCacheKeys.length} old cache keys`);
    }
    
    console.log('✅ Specific old cache cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing specific old cache:', error);
  }
}
