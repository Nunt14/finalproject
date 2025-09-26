# Cache Optimization Guide

## 🎯 เป้าหมาย
ลดการใช้ **Cached Egress** ใน Supabase เพื่อประหยัดค่าใช้จ่ายและเพิ่มประสิทธิภาพ

## 📋 สาเหตุที่ทำให้ Cached Egress เต็ม

### 1. **การอัปโหลดรูปภาพซ้ำๆ**
- อัปโหลดรูปภาพใน `PaymentUpload.tsx`, `profile.tsx`, `ProfileEdit.tsx`
- ใช้ `upsert: true` ทำให้อาจมีการอัปโหลดซ้ำ

### 2. **การเรียก `getPublicUrl` บ่อยเกินไป**
- เรียก `getPublicUrl` ทุกครั้งที่แสดงรูปภาพ
- ไม่มีการ cache URL ใน client-side

### 3. **การ fetch ข้อมูลซ้ำๆ**
- `fetchUser()` ถูกเรียกใน `useFocusEffect` ทุกครั้ง
- ไม่มีการ cache ข้อมูลใน AsyncStorage

## 🛠️ วิธีแก้ไขที่นำมาใช้

### 1. **Image Cache System**
```typescript
import { ImageCache } from '../utils/imageCache';

// แทนที่จะเรียก getPublicUrl ทุกครั้ง
const { data } = await supabase.storage
  .from('payment-proofs')
  .getPublicUrl(filePath);

// ใช้ ImageCache แทน
const imageUrl = await ImageCache.getImageUrl(filePath);
```

### 2. **Data Cache System**
```typescript
import { DataCache, CACHE_KEYS } from '../utils/dataCache';

// Check cache first
const cachedUser = await DataCache.get(`${CACHE_KEYS.USER_PROFILE}_${userId}`);
if (cachedUser) {
  setUser(cachedUser);
  return;
}

// Fetch from database if not cached
const { data } = await supabase.from('user').select('*').eq('user_id', userId).single();
if (data) {
  setUser(data);
  // Cache for 10 minutes
  await DataCache.set(`${CACHE_KEYS.USER_PROFILE}_${userId}`, data, 10 * 60 * 1000);
}
```

### 3. **Optimized Image Component**
```typescript
import { OptimizedImage } from '../components/OptimizedImage';

// แทนที่จะใช้ Image ปกติ
<Image source={{ uri: imageUrl }} style={styles.image} />

// ใช้ OptimizedImage แทน
<OptimizedImage filePath={filePath} style={styles.image} />
```

### 4. **Supabase Client Optimization**
```typescript
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
```

## 📊 ประโยชน์ที่ได้รับ

### 1. **ลด Cached Egress**
- Cache รูปภาพใน client-side เป็นเวลา 24 ชั่วโมง
- Cache ข้อมูลใน client-side เป็นเวลา 5-10 นาที
- ลดการเรียก `getPublicUrl` ซ้ำๆ

### 2. **เพิ่มประสิทธิภาพ**
- โหลดข้อมูลเร็วขึ้น (ใช้ cache)
- ลดการรอคอย network requests
- ประหยัด bandwidth

### 3. **ประหยัดค่าใช้จ่าย**
- ลดการใช้ Cached Egress ใน Supabase
- ลดการใช้ bandwidth

## 🔧 การใช้งาน

### 1. **Initialize Cache Manager**
```typescript
// ใน _layout.tsx
import { CacheManager } from '../utils/cacheManager';

React.useEffect(() => {
  CacheManager.initialize();
}, []);
```

### 2. **Clear Cache เมื่อจำเป็น**
```typescript
// เมื่อ logout
await CacheManager.clearAllCaches();

// เมื่อ user data เปลี่ยน
await CacheManager.clearUserCaches(userId);
```

### 3. **Monitor Cache Usage**
```typescript
const stats = await CacheManager.getCacheStats();
console.log('Image cache count:', stats.imageCacheCount);
console.log('Data cache count:', stats.dataCacheCount);
```

## ⚠️ ข้อควรระวัง

### 1. **Cache Expiration**
- รูปภาพ: 24 ชั่วโมง
- ข้อมูล: 5-10 นาที
- ควร clear cache เมื่อข้อมูลเปลี่ยน

### 2. **Storage Usage**
- Cache จะใช้ AsyncStorage
- ควรทำ cleanup เป็นระยะ

### 3. **Real-time Updates**
- ข้อมูลที่ cache อาจไม่เป็นปัจจุบัน
- ควร refresh เมื่อจำเป็น

## 📈 การวัดผล

### 1. **Monitor Supabase Dashboard**
- ดู Cached Egress usage
- เปรียบเทียบก่อนและหลัง optimization

### 2. **App Performance**
- วัดเวลาโหลดข้อมูล
- วัดเวลาแสดงรูปภาพ

### 3. **User Experience**
- ลดการรอคอย
- เพิ่มความเร็วในการใช้งาน

## 🚀 การพัฒนาต่อ

### 1. **Advanced Caching**
- Implement cache invalidation strategies
- Add cache compression
- Implement cache warming

### 2. **Analytics**
- Track cache hit rates
- Monitor cache performance
- Optimize cache durations

### 3. **Error Handling**
- Handle cache failures gracefully
- Implement fallback mechanisms
- Add retry logic
