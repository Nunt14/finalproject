# คู่มือแก้ไขปัญหา Infinite Recursion ใน trip_member RLS Policies

## ปัญหาที่พบ
```
ERROR: infinite recursion detected in policy for relation "trip_member"
```

## สาเหตุของปัญหา
- RLS Policy ของตาราง `trip_member` มีการอ้างอิงตัวเองในลักษณะที่ทำให้เกิดการเรียกซ้ำแบบไม่สิ้นสุด (infinite loop)
- เกิดจากการที่ SELECT policy ตรวจสอบสิทธิ์โดยการ query ตาราง `trip_member` ซึ่งจะเรียก policy เดิมซ้ำอีกครั้ง

## วิธีแก้ไข

### ขั้นตอนที่ 1: เข้าใจโครงสร้างการแก้ไข
การแก้ไขใช้วิธี **SECURITY DEFINER Function** เพื่อตัดวงจรการเรียกซ้ำ:
- สร้างฟังก์ชัน `is_trip_member()` ที่ทำงานด้วยสิทธิ์ของผู้สร้างฟังก์ชัน
- ใช้ฟังก์ชันนี้แทนการ query ตาราง `trip_member` โดยตรงใน policy

### ขั้นตอนที่ 2: รันสคริปต์แก้ไข

#### วิธีที่ 1: ใช้ Supabase Dashboard
1. เปิด Supabase Dashboard
2. ไปที่ **SQL Editor**
3. คัดลอกโค้ดจากไฟล์ `fix_trip_member_rls_recursion.sql`
4. วางในช่อง SQL Editor
5. กดปุ่ม **Run** เพื่อรันคำสั่ง

#### วิธีที่ 2: ใช้ psql Command Line
```bash
psql -h <your-db-host> -U postgres -d postgres -f "c:/Users/Victus 15/finalproject/my-app/sql/fix_trip_member_rls_recursion.sql"
```

#### วิธีที่ 3: ใช้ Supabase CLI
```bash
supabase db execute --file sql/fix_trip_member_rls_recursion.sql
```

### ขั้นตอนที่ 3: ตรวจสอบผลลัพธ์
หลังจากรันสคริปต์แล้ว คุณควรเห็นข้อความ:
```
แก้ไข RLS policies ของ trip_member สำเร็จแล้ว
```

### ขั้นตอนที่ 4: ทดสอบแอปพลิเคชัน
1. รีสตาร์ทแอปพลิเคชันของคุณ
2. ลองดึงข้อมูล trips อีกครั้ง
3. ตรวจสอบว่าไม่มี error เกี่ยวกับ infinite recursion อีก

## รายละเอียดการทำงานของ Policies ใหม่

### 1. ฟังก์ชัน is_trip_member()
```sql
CREATE OR REPLACE FUNCTION public.is_trip_member(trip_id_param uuid, user_id_param uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.trip_member tm 
        WHERE tm.trip_id = trip_id_param 
        AND tm.user_id = user_id_param
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
- ใช้ `SECURITY DEFINER` เพื่อให้ฟังก์ชันทำงานด้วยสิทธิ์ของผู้สร้าง ไม่ใช่ผู้เรียกใช้
- ช่วยตัดวงจรการเรียกซ้ำของ RLS policy

### 2. SELECT Policy
**ผู้ใช้สามารถดูสมาชิกทริปได้เมื่อ:**
- เป็นผู้สร้างทริป (created_by)
- หรือเป็นสมาชิกของทริป (ตรวจสอบผ่านฟังก์ชัน is_trip_member)

### 3. INSERT Policy
**ผู้ใช้สามารถเพิ่มสมาชิกได้เมื่อ:**
- เป็นผู้สร้างทริป
- หรือเป็นสมาชิกของทริปอยู่แล้ว

### 4. UPDATE Policy
**ผู้ใช้สามารถอัปเดตสมาชิกได้เมื่อ:**
- เป็นผู้สร้างทริป
- หรือกำลังอัปเดตข้อมูลสมาชิกภาพของตัวเอง

### 5. DELETE Policy
**ผู้ใช้สามารถลบสมาชิกได้เมื่อ:**
- เป็นผู้สร้างทริป
- หรือกำลังลบสมาชิกภาพของตัวเอง (ออกจากทริป)

## การตรวจสอบว่า Policies ทำงานถูกต้อง

### ตรวจสอบ Policies ที่ติดตั้งแล้ว
```sql
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'trip_member';
```

### ตรวจสอบว่า RLS เปิดใช้งานแล้ว
```sql
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'trip_member';
```
ผลลัพธ์ควรแสดง `rowsecurity = true`

## หมายเหตุสำคัญ

⚠️ **ข้อควรระวัง:**
- ฟังก์ชัน `is_trip_member()` ใช้ `SECURITY DEFINER` ซึ่งหมายความว่าจะทำงานด้วยสิทธิ์ของผู้สร้างฟังก์ชัน
- ตรวจสอบให้แน่ใจว่าผู้ใช้ที่สร้างฟังก์ชันมีสิทธิ์เข้าถึงตาราง `trip_member`

✅ **ข้อดีของวิธีนี้:**
- แก้ปัญหา infinite recursion ได้อย่างสมบูรณ์
- ไม่เปลี่ยนแปลงตรรกะการตรวจสอบสิทธิ์
- ประสิทธิภาพดีกว่าการใช้ subquery ซ้อนกัน

## การแก้ไขปัญหาเพิ่มเติม

หากยังพบปัญหาหลังจากรันสคริปต์:

1. **ตรวจสอบว่าสคริปต์รันสำเร็จ:**
   ```sql
   SELECT routine_name, routine_type 
   FROM information_schema.routines 
   WHERE routine_name = 'is_trip_member';
   ```

2. **ลบ policies เก่าทั้งหมดด้วยตนเอง:**
   ```sql
   DROP POLICY IF EXISTS "trip_member_select_policy" ON public.trip_member;
   DROP POLICY IF EXISTS "trip_member_insert_policy" ON public.trip_member;
   DROP POLICY IF EXISTS "trip_member_update_policy" ON public.trip_member;
   DROP POLICY IF EXISTS "trip_member_delete_policy" ON public.trip_member;
   ```

3. **รันสคริปต์อีกครั้ง**

## ติดต่อสอบถาม
หากยังพบปัญหา ให้ตรวจสอบ:
- Log ของ Supabase/PostgreSQL
- ตรวจสอบว่ามี policies อื่นที่ขัดแย้งหรือไม่
- ตรวจสอบว่า auth.uid() ทำงานถูกต้องหรือไม่
