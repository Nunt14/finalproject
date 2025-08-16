-- สร้างตาราง notifications สำหรับเก็บการแจ้งเตือนต่างๆ
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('friend_request', 'friend_accepted', 'trip_invite', 'payment', 'expense_added', 'expense_paid')),
  title VARCHAR(255) NOT NULL,
  message TEXT,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- สร้าง index เพื่อเพิ่มประสิทธิภาพการค้นหา
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- สร้าง RLS (Row Level Security) policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: ผู้ใช้สามารถดูเฉพาะการแจ้งเตือนของตัวเอง
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: ผู้ใช้สามารถอัปเดตเฉพาะการแจ้งเตือนของตัวเอง
CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: ระบบสามารถสร้างการแจ้งเตือนได้
CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- สร้าง function สำหรับอัปเดต updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- สร้าง trigger สำหรับอัปเดต updated_at อัตโนมัติ
CREATE TRIGGER update_notifications_updated_at 
  BEFORE UPDATE ON notifications 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- เพิ่ม comment อธิบายตาราง
COMMENT ON TABLE notifications IS 'ตารางเก็บการแจ้งเตือนต่างๆ ของผู้ใช้';
COMMENT ON COLUMN notifications.type IS 'ประเภทการแจ้งเตือน: friend_request, friend_accepted, trip_invite, payment, expense_added, expense_paid';
COMMENT ON COLUMN notifications.is_read IS 'สถานะการอ่าน: true = อ่านแล้ว, false = ยังไม่อ่าน';
