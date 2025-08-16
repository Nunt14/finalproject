# ระบบการแจ้งเตือน (Notification System)

## ภาพรวม
ระบบการแจ้งเตือนถูกออกแบบมาเพื่อแจ้งเตือนผู้ใช้เมื่อมีการเปลี่ยนแปลงที่สำคัญในแอปพลิเคชัน เช่น การส่งคำขอเป็นเพื่อน การตอบรับคำขอเป็นเพื่อน การเชิญเข้าร่วมทริป และการจ่ายเงิน

## คุณสมบัติหลัก

### 1. ประเภทการแจ้งเตือน
- **friend_request**: เมื่อมีคนส่งคำขอเป็นเพื่อน
- **friend_accepted**: เมื่อคำขอเป็นเพื่อนถูกตอบรับ
- **trip_invite**: เมื่อถูกเชิญเข้าร่วมทริป
- **payment**: เมื่อมีการจ่ายเงิน
- **expense_added**: เมื่อมีการเพิ่มค่าใช้จ่ายใหม่
- **expense_paid**: เมื่อมีการชำระค่าใช้จ่าย

### 2. การแสดงผล
- แยกตามวันที่ (Today, Yesterday, Earlier)
- แสดงสถานะการอ่าน (อ่านแล้ว/ยังไม่อ่าน)
- ไอคอนที่แตกต่างกันตามประเภทการแจ้งเตือน
- ข้อความที่เข้าใจง่าย

### 3. การจัดการ
- คลิกเพื่อทำเครื่องหมายว่าอ่านแล้ว
- อัปเดตสถานะแบบ real-time
- จัดเก็บในฐานข้อมูล Supabase

## การติดตั้ง

### 1. สร้างตารางในฐานข้อมูล
รัน SQL script ใน `sql/create_notifications_table.sql` ใน Supabase SQL Editor

### 2. ตรวจสอบการเชื่อมต่อ
ตรวจสอบว่าไฟล์ `constants/supabase.ts` มีการตั้งค่าที่ถูกต้อง

## การใช้งาน

### การสร้างการแจ้งเตือน
```typescript
// ตัวอย่างการสร้างการแจ้งเตือนคำขอเป็นเพื่อน
const { error } = await supabase
  .from('notifications')
  .insert({
    user_id: receiverId,
    type: 'friend_request',
    title: 'คำขอเป็นเพื่อนใหม่',
    message: 'คุณได้รับคำขอเป็นเพื่อนใหม่',
    sender_id: currentUserId,
    is_read: false,
    created_at: new Date().toISOString(),
  });
```

### การดึงการแจ้งเตือน
```typescript
const { data, error } = await supabase
  .from('notifications')
  .select(`
    *,
    sender:user!notifications_sender_id_fkey(user_id, full_name, profile_image_url)
  `)
  .eq('user_id', currentUserId)
  .order('created_at', { ascending: false });
```

### การอัปเดตสถานะการอ่าน
```typescript
const { error } = await supabase
  .from('notifications')
  .update({ is_read: true })
  .eq('id', notificationId);
```

## โครงสร้างฐานข้อมูล

### ตาราง notifications
- `id`: UUID (Primary Key)
- `user_id`: UUID (ผู้รับการแจ้งเตือน)
- `type`: VARCHAR (ประเภทการแจ้งเตือน)
- `title`: VARCHAR (หัวข้อการแจ้งเตือน)
- `message`: TEXT (ข้อความเพิ่มเติม)
- `sender_id`: UUID (ผู้ส่งการแจ้งเตือน)
- `trip_id`: UUID (ID ทริปที่เกี่ยวข้อง)
- `expense_id`: UUID (ID ค่าใช้จ่ายที่เกี่ยวข้อง)
- `is_read`: BOOLEAN (สถานะการอ่าน)
- `created_at`: TIMESTAMP (เวลาที่สร้าง)
- `updated_at`: TIMESTAMP (เวลาที่อัปเดตล่าสุด)

## ความปลอดภัย

### Row Level Security (RLS)
- ผู้ใช้สามารถดูเฉพาะการแจ้งเตือนของตัวเอง
- ผู้ใช้สามารถอัปเดตเฉพาะการแจ้งเตือนของตัวเอง
- ระบบสามารถสร้างการแจ้งเตือนได้

### Indexes
- `user_id`: สำหรับการค้นหาตามผู้ใช้
- `type`: สำหรับการกรองตามประเภท
- `created_at`: สำหรับการเรียงลำดับตามเวลา
- `is_read`: สำหรับการกรองตามสถานะการอ่าน

## การขยายระบบ

### เพิ่มประเภทการแจ้งเตือนใหม่
1. เพิ่มประเภทใน CHECK constraint ของตาราง
2. อัปเดต interface Notification ใน TypeScript
3. เพิ่มการจัดการใน `getNotificationIcon` และ `getNotificationText`
4. เพิ่มการสร้างการแจ้งเตือนในฟังก์ชันที่เกี่ยวข้อง

### เพิ่มฟีเจอร์ใหม่
- การแจ้งเตือนแบบ push notification
- การตั้งค่าการแจ้งเตือน
- การกรองการแจ้งเตือน
- การลบการแจ้งเตือน

## การแก้ไขปัญหา

### ปัญหาที่พบบ่อย
1. **การแจ้งเตือนไม่แสดง**: ตรวจสอบ RLS policies และ user_id
2. **Error ในการสร้าง**: ตรวจสอบ foreign key constraints
3. **Performance**: ตรวจสอบ indexes และ query optimization

### การ Debug
- ใช้ console.log เพื่อตรวจสอบข้อมูล
- ตรวจสอบ Supabase logs
- ใช้ SQL Editor เพื่อทดสอบ queries

## ตัวอย่างการใช้งานจริง

### ในหน้า AddFriends.tsx
- สร้างการแจ้งเตือนเมื่อส่งคำขอเป็นเพื่อน
- สร้างการแจ้งเตือนเมื่อตอบรับคำขอเป็นเพื่อน

### ในหน้า Notification.tsx
- แสดงการแจ้งเตือนทั้งหมดของผู้ใช้
- จัดกลุ่มตามวันที่
- จัดการสถานะการอ่าน

## หมายเหตุ
- ระบบใช้ Supabase เป็น backend
- รองรับ TypeScript เพื่อความปลอดภัยของ type
- ใช้ React Native components สำหรับ UI
- รองรับการทำงานแบบ offline (ข้อมูลจะ sync เมื่อ online)
