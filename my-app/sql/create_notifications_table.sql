-- สร้างตาราง notifications สำหรับเก็บการแจ้งเตือนต่างๆ
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('friend_request', 'friend_accepted', 'trip_invite', 'payment', 'expense_added', 'expense_paid')),
  title VARCHAR(255) NOT NULL,
  message TEXT,
  sender_id UUID REFERENCES "user"(user_id) ON DELETE SET NULL,
  trip_id UUID REFERENCES trip(trip_id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- สร้าง index เพื่อเพิ่มประสิทธิภาพการค้นหา
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- สร้าง RLS (Row Level Security) policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: ผู้ใช้สามารถดูเฉพาะการแจ้งเตือนของตัวเอง
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: ผู้ใช้สามารถอัปเดตเฉพาะการแจ้งเตือนของตัวเอง
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: ระบบสามารถสร้างการแจ้งเตือนได้
CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);
