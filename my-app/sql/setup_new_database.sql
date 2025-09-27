-- สคริปต์สำหรับตั้งค่าฐานข้อมูลใหม่
-- รันใน Supabase SQL Editor ของโปรเจค teejginbhuiyyyzjqawv

-- 1. สร้างตาราง user
CREATE TABLE IF NOT EXISTS "user" (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  phone_number VARCHAR(20),
  profile_image_url TEXT,
  qr_code_img TEXT,
  currency_preference VARCHAR(3) DEFAULT 'THB',
  language_preference VARCHAR(2) DEFAULT 'TH',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. สร้างตาราง trip
CREATE TABLE IF NOT EXISTS trip (
  trip_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  created_by UUID NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  color VARCHAR(7) DEFAULT '#1A3C6B',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. สร้างตาราง trip_member
CREATE TABLE IF NOT EXISTS trip_member (
  trip_member_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trip(trip_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(trip_id, user_id)
);

-- 4. สร้างตาราง bill
CREATE TABLE IF NOT EXISTS bill (
  bill_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trip(trip_id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  category_id INTEGER,
  paid_by UUID NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. สร้างตาราง bill_share
CREATE TABLE IF NOT EXISTS bill_share (
  bill_share_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES bill(bill_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  is_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(bill_id, user_id)
);

-- 6. สร้างตาราง payment
CREATE TABLE IF NOT EXISTS payment (
  payment_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_share_id UUID REFERENCES bill_share(bill_share_id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  method VARCHAR(50) DEFAULT 'qr',
  status VARCHAR(20) DEFAULT 'pending',
  transaction_id VARCHAR(255),
  slip_qr TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. สร้างตาราง payment_proof
CREATE TABLE IF NOT EXISTS payment_proof (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES bill(bill_id) ON DELETE CASCADE,
  creditor_id UUID NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  debtor_user_id UUID NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  amount DECIMAL(10,2),
  image_uri_local TEXT,
  slip_qr TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. สร้างตาราง notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('friend_request', 'friend_accepted', 'trip_invite', 'payment', 'expense_added', 'expense_paid')),
  title VARCHAR(255) NOT NULL,
  message TEXT,
  sender_id UUID REFERENCES "user"(user_id) ON DELETE SET NULL,
  trip_id UUID REFERENCES trip(trip_id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. สร้าง indexes เพื่อเพิ่มประสิทธิภาพ
CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);
CREATE INDEX IF NOT EXISTS idx_trip_created_by ON trip(created_by);
CREATE INDEX IF NOT EXISTS idx_trip_member_trip_id ON trip_member(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_member_user_id ON trip_member(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_trip_id ON bill(trip_id);
CREATE INDEX IF NOT EXISTS idx_bill_share_bill_id ON bill_share(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_share_user_id ON bill_share(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_bill_share_id ON payment(bill_share_id);
CREATE INDEX IF NOT EXISTS idx_payment_proof_bill_id ON payment_proof(bill_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- 10. เปิดใช้งาน Row Level Security (RLS)
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_share ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_proof ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 11. สร้าง RLS Policies
-- User policies
CREATE POLICY "Users can view their own profile" ON "user"
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON "user"
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON "user"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trip policies
CREATE POLICY "Users can view trips they are members of" ON trip
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trip_member 
      WHERE trip_member.trip_id = trip.trip_id 
      AND trip_member.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create trips" ON trip
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Trip creators can update their trips" ON trip
  FOR UPDATE USING (auth.uid() = created_by);

-- Trip member policies
CREATE POLICY "Users can view trip members of their trips" ON trip_member
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trip_member tm2 
      WHERE tm2.trip_id = trip_member.trip_id 
      AND tm2.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip creators can add members" ON trip_member
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip 
      WHERE trip.trip_id = trip_member.trip_id 
      AND trip.created_by = auth.uid()
    )
  );

-- Bill policies
CREATE POLICY "Users can view bills of their trips" ON bill
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trip_member 
      WHERE trip_member.trip_id = bill.trip_id 
      AND trip_member.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create bills in their trips" ON bill
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_member 
      WHERE trip_member.trip_id = bill.trip_id 
      AND trip_member.user_id = auth.uid()
    )
  );

-- Bill share policies
CREATE POLICY "Users can view their bill shares" ON bill_share
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their bill shares" ON bill_share
  FOR UPDATE USING (auth.uid() = user_id);

-- Payment policies
CREATE POLICY "Users can view their payments" ON payment
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bill_share 
      WHERE bill_share.bill_share_id = payment.bill_share_id 
      AND bill_share.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create payments for their bills" ON payment
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bill_share 
      WHERE bill_share.bill_share_id = payment.bill_share_id 
      AND bill_share.user_id = auth.uid()
    )
  );

-- Payment proof policies
CREATE POLICY "Users can view payment proofs they are involved in" ON payment_proof
  FOR SELECT USING (auth.uid() = creditor_id OR auth.uid() = debtor_user_id);

CREATE POLICY "Users can create payment proofs" ON payment_proof
  FOR INSERT WITH CHECK (auth.uid() = debtor_user_id);

-- Notification policies
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- 12. สร้าง function สำหรับอัปเดต updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 13. สร้าง triggers สำหรับอัปเดต updated_at อัตโนมัติ
CREATE TRIGGER update_user_updated_at 
  BEFORE UPDATE ON "user" 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trip_updated_at 
  BEFORE UPDATE ON trip 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bill_updated_at 
  BEFORE UPDATE ON bill 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_updated_at 
  BEFORE UPDATE ON payment 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at 
  BEFORE UPDATE ON notifications 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 14. เพิ่ม comments
COMMENT ON TABLE "user" IS 'ตารางข้อมูลผู้ใช้';
COMMENT ON TABLE trip IS 'ตารางข้อมูลทริป';
COMMENT ON TABLE trip_member IS 'ตารางสมาชิกในทริป';
COMMENT ON TABLE bill IS 'ตารางบิลค่าใช้จ่าย';
COMMENT ON TABLE bill_share IS 'ตารางการแบ่งปันบิล';
COMMENT ON TABLE payment IS 'ตารางการชำระเงิน';
COMMENT ON TABLE payment_proof IS 'ตารางหลักฐานการชำระเงิน';
COMMENT ON TABLE notifications IS 'ตารางการแจ้งเตือน';

-- 15. สร้าง Storage bucket สำหรับรูปภาพ
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- 16. สร้าง Storage policies
CREATE POLICY "Users can upload payment proofs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'payment-proofs' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view payment proofs" ON storage.objects
  FOR SELECT USING (bucket_id = 'payment-proofs');

CREATE POLICY "Users can update their own payment proofs" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'payment-proofs' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own payment proofs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'payment-proofs' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- เสร็จสิ้นการตั้งค่า
SELECT 'Database setup completed successfully!' as status;
