# การแก้ไขปัญหา (Troubleshooting)

## ปัญหาที่เกิดขึ้น
```
ERROR Fetch notifications error: {"code": "PGRST200", "details": "Searched for a foreign key relationship between 'notifications' and 'user' using the hint 'notifications_sender_id_fkey' in the schema 'public', but no matches were found.", "hint": "Perhaps you meant 'notification' instead of 'notifications'.", "message": "Could not find a relationship between 'notifications' and 'user' in the schema cache"}
```

## สาเหตุของปัญหา
1. **Foreign Key Constraint ไม่ได้ถูกสร้าง**: ตาราง `notifications` ไม่มีการเชื่อมโยงกับตาราง `user` ผ่าน foreign key
2. **RLS Policies ไม่ถูกต้อง**: Row Level Security policies อาจไม่ทำงานตามที่คาดหวัง
3. **การ Query ที่ซับซ้อนเกินไป**: การใช้ `sender:user!notifications_sender_id_fkey` ต้องการ foreign key relationship ที่ถูกต้อง

## วิธีแก้ไข

### 1. สร้างตารางใหม่ (แนะนำ)
รัน SQL script ใน `sql/create_notifications_basic.sql` ใน Supabase SQL Editor:

```sql
-- ลบตารางเก่าถ้ามี
DROP TABLE IF EXISTS notifications;

-- สร้างตารางใหม่
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  sender_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- สร้าง index และ RLS policies
-- (ดูไฟล์ SQL สำหรับรายละเอียด)
```

### 2. แก้ไขการ Query ใน Notification.tsx
เปลี่ยนจากการใช้ foreign key relationship เป็นการ query แยก:

```typescript
// แทนที่จะใช้
.select(`
  *,
  sender:user!notifications_sender_id_fkey(user_id, full_name, profile_image_url)
`)

// ให้ใช้
.select('*')

// แล้วดึงข้อมูลผู้ส่งแยกต่างหาก
const senderIds = [...new Set(data.map(n => n.sender_id).filter(Boolean))];
if (senderIds.length > 0) {
  const { data: userData } = await supabase
    .from('user')
    .select('user_id, full_name, profile_image_url')
    .in('user_id', senderIds);
  
  // รวมข้อมูลเข้าด้วยกัน
}
```

### 3. ตรวจสอบการเชื่อมต่อฐานข้อมูล
ตรวจสอบว่าไฟล์ `constants/supabase.ts` มีการตั้งค่าที่ถูกต้อง:

```typescript
export const supabase = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_SUPABASE_ANON_KEY'
);
```

### 4. ตรวจสอบ RLS Policies
ใน Supabase Dashboard > Authentication > Policies:
- ตรวจสอบว่าตาราง `notifications` มี RLS policies ที่ถูกต้อง
- ตรวจสอบว่า policies อนุญาตให้ผู้ใช้ดูและอัปเดตการแจ้งเตือนของตัวเอง

## ขั้นตอนการทดสอบ

### 1. สร้างตารางใหม่
```bash
# ไปที่ Supabase Dashboard > SQL Editor
# รันไฟล์ sql/create_notifications_basic.sql
```

### 2. ทดสอบการสร้างการแจ้งเตือน
```bash
# ไปที่หน้า AddFriends
# ลองส่งคำขอเป็นเพื่อน
# ตรวจสอบว่าไม่เกิด error
```

### 3. ทดสอบการแสดงการแจ้งเตือน
```bash
# ไปที่หน้า Notification
# ตรวจสอบว่าการแจ้งเตือนแสดงขึ้นมา
# ตรวจสอบว่าไม่มี error ใน console
```

## การป้องกันปัญหาในอนาคต

### 1. ใช้ SQL Scripts ที่ผ่านการทดสอบ
- ใช้ไฟล์ `sql/create_notifications_basic.sql` สำหรับการสร้างตารางใหม่
- ทดสอบ SQL scripts ใน Supabase SQL Editor ก่อนใช้งานจริง

### 2. หลีกเลี่ยงการ Query ที่ซับซ้อน
- ใช้การ query แบบง่ายก่อน
- เพิ่มความซับซ้อนทีละขั้นตอน

### 3. ตรวจสอบ Error Logs
- ดู console logs ใน React Native
- ตรวจสอบ Supabase logs ใน Dashboard

## หมายเหตุสำคัญ
- **Foreign Key Constraints**: ไม่จำเป็นต้องใช้ในขั้นตอนแรก สามารถเพิ่มภายหลังได้
- **RLS Policies**: ต้องสร้างให้ถูกต้องเพื่อความปลอดภัย
- **Testing**: ทดสอบทีละฟีเจอร์เพื่อหาจุดที่มีปัญหา

## ติดต่อขอความช่วยเหลือ
หากยังมีปัญหา ให้ตรวจสอบ:
1. Supabase Dashboard > Logs
2. React Native Console
3. Network requests ใน Developer Tools
