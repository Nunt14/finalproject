import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SUPABASE_URL = 'https://teejginbhuiyyyzjqawv.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZWpnaW5iaHVpeXl5empxYXd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NTU2NDksImV4cCI6MjA3NDQzMTY0OX0.R_MT5U_oiveh6h0b9bF0qwIT-Q0VTqc2K1rNEqAhQaM';

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
  // Disable real-time subscriptions completely to save bandwidth
  realtime: {
    params: {
      eventsPerSecond: 0, // Disable real-time events
    },
  },
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
