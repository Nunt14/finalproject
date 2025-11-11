// Polyfills required for Supabase client to work correctly in React Native / Expo
// - react-native-url-polyfill provides URL and URLSearchParams
// - react-native-get-random-values provides crypto-safe random values used by some libs
import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
export const SUPABASE_URL = extra.SUPABASE_URL;
export const SUPABASE_ANON_KEY = extra.SUPABASE_ANON_KEY;

// ใช้ storageKey คงที่ ผูกกับ project-ref เพื่อกันชนกับโปรเจกต์อื่น
const STORAGE_KEY = 'sb-teejginbhuiyyyzjqawv-auth-token';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: STORAGE_KEY,
  },
  // Aggressive caching to minimize Cached Egress
  global: {
    headers: {
      'Cache-Control': 'max-age=3600', // 1 hour cache
      'X-Client-Info': 'bill-splitter-app',
    },
  },
  // Realtime enabled (use defaults). If needed, you can tune params here.
  // realtime: { params: { eventsPerSecond: 10 } },
  // Disable automatic retries to reduce requests
  db: {
    schema: 'public',
  },
});

// เมื่อ refresh token ใช้ไม่ได้ Supabase จะส่งอีเวนต์ SIGNED_OUT ให้เราเคลียร์ key ทิ้ง
supabase.auth.onAuthStateChange(async (event) => {
  if (event === 'SIGNED_OUT') {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
});

// helper สำหรับเคลียร์โทเค็นที่เสีย และเซ็นเอาท์อย่างแรง
export async function hardResetAuth(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {}
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    // เผื่อเคยใช้ค่า default มาก่อน
    await AsyncStorage.removeItem('sb-teejginbhuiyyyzjqawv-auth-token');
  } catch {}
}
