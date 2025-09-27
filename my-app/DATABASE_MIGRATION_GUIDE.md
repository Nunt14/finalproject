# 🗄️ Database Migration Guide

## 📋 ขั้นตอนการย้ายฐานข้อมูล

### **1. 🔑 ได้ API Key ใหม่**
1. ไปที่ [Supabase Dashboard](https://supabase.com/dashboard)
2. เลือกโปรเจค `teejginbhuiyyyzjqawv`
3. ไปที่ **Settings > API**
4. คัดลอก **anon public** key
5. แทนที่ใน `constants/supabase.ts`:

```typescript
export const SUPABASE_ANON_KEY = 'YOUR_NEW_ANON_KEY_HERE';
```

### **2. 📊 สร้างโครงสร้างฐานข้อมูล**
1. ไปที่ **SQL Editor** ใน Supabase Dashboard
2. รันไฟล์ `sql/setup_new_database.sql`
3. ตรวจสอบว่าตารางทั้งหมดถูกสร้างแล้ว

### **3. 🗂️ ตั้งค่า Storage**
1. ไปที่ **Storage** ใน Supabase Dashboard
2. ตรวจสอบว่า bucket `payment-proofs` ถูกสร้างแล้ว
3. ตั้งค่า permissions ตามที่กำหนดใน SQL script

### **4. 🔐 ตั้งค่า Authentication**
1. ไปที่ **Authentication > Settings**
2. ตั้งค่า **Site URL**: `exp://localhost:8081` (สำหรับ development)
3. ตั้งค่า **Redirect URLs** ตามความเหมาะสม

### **5. 🧪 ทดสอบการเชื่อมต่อ**
1. รันแอป: `npm start`
2. ทดสอบการสมัครสมาชิก
3. ทดสอบการสร้างทริป
4. ทดสอบการอัปโหลดรูปภาพ

## ⚠️ ข้อควรระวัง

### **ข้อมูลเก่าจะหายไป**
- ฐานข้อมูลใหม่จะไม่มีข้อมูลเก่า
- ต้องสร้างบัญชีผู้ใช้ใหม่
- ต้องสร้างทริปและบิลใหม่

### **การทดสอบ**
- ทดสอบทุกฟีเจอร์หลัก
- ตรวจสอบการทำงานของ OCR
- ตรวจสอบการอัปโหลดรูปภาพ

## 🔧 การแก้ไขปัญหา

### **Error: Invalid API Key**
- ตรวจสอบ API Key ใน `constants/supabase.ts`
- ตรวจสอบว่าใช้ anon public key ไม่ใช่ service role key

### **Error: Table doesn't exist**
- รัน SQL script `setup_new_database.sql` อีกครั้ง
- ตรวจสอบใน **Table Editor** ว่าตารางถูกสร้างแล้ว

### **Error: Storage bucket not found**
- ตรวจสอบใน **Storage** ว่ามี bucket `payment-proofs`
- สร้าง bucket ใหม่ถ้าไม่มี

### **Error: RLS Policy violation**
- ตรวจสอบ RLS policies ใน SQL script
- ตรวจสอบว่า user ถูก authenticate แล้ว

## 📱 การอัปเดตแอป

### **Clear Cache**
```typescript
import { CacheManager } from './utils/cacheManager';

// Clear all caches when switching database
await CacheManager.clearAllCaches();
```

### **Reset User Session**
```typescript
import { hardResetAuth } from './constants/supabase';

// Reset authentication
await hardResetAuth();
```

## ✅ Checklist

- [ ] ได้ API Key ใหม่
- [ ] อัปเดต `constants/supabase.ts`
- [ ] รัน SQL script สร้างตาราง
- [ ] ตั้งค่า Storage bucket
- [ ] ทดสอบการสมัครสมาชิก
- [ ] ทดสอบการสร้างทริป
- [ ] ทดสอบการอัปโหลดรูปภาพ
- [ ] ทดสอบ OCR
- [ ] Clear cache เก่า
- [ ] ทดสอบทุกฟีเจอร์

## 🆘 การขอความช่วยเหลือ

หากพบปัญหา:
1. ตรวจสอบ Console logs
2. ตรวจสอบ Supabase Dashboard logs
3. ตรวจสอบ Network requests
4. ตรวจสอบ RLS policies
