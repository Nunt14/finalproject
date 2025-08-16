-- สร้างตาราง notifications แบบง่าย
-- รันใน Supabase SQL Editor

-- สร้างตาราง notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- สร้าง index พื้นฐาน
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_sender_id ON notifications(sender_id);

-- เปิดใช้งาน RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- สร้าง policy พื้นฐาน
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- เพิ่ม comment
COMMENT ON TABLE notifications IS 'ตารางเก็บการแจ้งเตือนต่างๆ ของผู้ใช้';
COMMENT ON COLUMN notifications.user_id IS 'ID ของผู้รับการแจ้งเตือน (อ้างอิงจาก auth.users)';
COMMENT ON COLUMN notifications.sender_id IS 'ID ของผู้ส่งการแจ้งเตือน (อ้างอิงจาก auth.users)';
