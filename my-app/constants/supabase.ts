import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SUPABASE_URL = 'https://kiwketmokykkyotpwdmm.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpd2tldG1va3lra3lvdHB3ZG1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2OTI0MTMsImV4cCI6MjA2OTI2ODQxM30.meC3vFGhBDCj4DF66ITDNNEUlsRIt4d1UOldBpiwGyw';

// ใช้ storageKey คงที่ ผูกกับ project-ref เพื่อกันชนกับโปรเจกต์อื่น
const STORAGE_KEY = 'sb-kiwketmokykkyotpwdmm-auth-token';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: STORAGE_KEY,
  },
  // Optimize for reduced bandwidth usage
  global: {
    headers: {
      'Cache-Control': 'max-age=300', // 5 minutes cache
    },
  },
  // Disable real-time subscriptions by default to reduce bandwidth
  realtime: {
    params: {
      eventsPerSecond: 2, // Limit real-time events
    },
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
    await AsyncStorage.removeItem('sb-kiwketmokykkyotpwdmm-auth-token');
  } catch {}
}
