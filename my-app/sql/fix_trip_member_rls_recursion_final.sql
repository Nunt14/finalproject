-- แก้ไขปัญหา infinite recursion ใน RLS policies ของ trip_member อย่างถาวร
-- ปรับให้ตรงกับโครงสร้างตารางจริงที่มีคอลัมน์ is_admin และ is_active

-- ขั้นตอนที่ 1: ลบ policies และฟังก์ชันเดิมทั้งหมด
DROP POLICY IF EXISTS "Users can view trip members" ON public.trip_member;
DROP POLICY IF EXISTS "Users can insert trip members" ON public.trip_member;
DROP POLICY IF EXISTS "Users can update trip members" ON public.trip_member;
DROP POLICY IF EXISTS "Users can delete trip members" ON public.trip_member;
DROP POLICY IF EXISTS "trip_member_select_policy" ON public.trip_member;
DROP POLICY IF EXISTS "trip_member_insert_policy" ON public.trip_member;
DROP POLICY IF EXISTS "trip_member_update_policy" ON public.trip_member;
DROP POLICY IF EXISTS "trip_member_delete_policy" ON public.trip_member;
DROP FUNCTION IF EXISTS public.is_trip_member(uuid, uuid);

-- ขั้นตอนที่ 2: สร้างฟังก์ชันใหม่สำหรับตรวจสอบสิทธิ์ผู้สร้างทริป
CREATE OR REPLACE FUNCTION public.check_trip_creator_access(trip_id_param uuid, user_id_param uuid)
RETURNS boolean AS $$
BEGIN
    -- ตรวจสอบว่าผู้ใช้เป็นผู้สร้างทริปหรือไม่ โดยไม่ผ่าน RLS
    RETURN EXISTS (
        SELECT 1 FROM public.trip t
        WHERE t.trip_id = trip_id_param
        AND t.created_by = user_id_param
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ขั้นตอนที่ 3: สร้าง SELECT policy ใหม่ที่ไม่ทำให้เกิด recursion
CREATE POLICY "trip_member_select_policy" ON public.trip_member
    FOR SELECT
    USING (
        -- ผู้ใช้สามารถดูสมาชิกทริปได้ถ้าเป็นผู้สร้างทริป หรือเป็นสมาชิกที่ active ของทริป
        public.check_trip_creator_access(trip_member.trip_id, auth.uid())
        OR
        (user_id = auth.uid() AND is_active = true)
    );

-- ขั้นตอนที่ 4: สร้าง INSERT policy ใหม่
CREATE POLICY "trip_member_insert_policy" ON public.trip_member
    FOR INSERT
    WITH CHECK (
        -- ผู้ใช้สามารถเพิ่มสมาชิกได้ถ้าเป็นผู้สร้างทริป หรือเป็นสมาชิกที่ active อยู่แล้ว
        public.check_trip_creator_access(trip_member.trip_id, auth.uid())
        OR
        EXISTS (
            SELECT 1 FROM public.trip_member tm
            WHERE tm.trip_id = trip_member.trip_id
            AND tm.user_id = auth.uid()
            AND tm.is_active = true
        )
    );

-- ขั้นตอนที่ 5: สร้าง UPDATE policy ใหม่
CREATE POLICY "trip_member_update_policy" ON public.trip_member
    FOR UPDATE
    USING (
        -- ผู้ใช้สามารถอัปเดตได้ถ้าเป็นผู้สร้างทริป หรือกำลังอัปเดตข้อมูลของตัวเองและยัง active อยู่
        public.check_trip_creator_access(trip_member.trip_id, auth.uid())
        OR
        (user_id = auth.uid() AND is_active = true)
    )
    WITH CHECK (
        -- เงื่อนไขเดียวกับ USING สำหรับค่าใหม่
        public.check_trip_creator_access(trip_member.trip_id, auth.uid())
        OR
        (user_id = auth.uid() AND is_active = true)
    );

-- ขั้นตอนที่ 6: สร้าง DELETE policy ใหม่
CREATE POLICY "trip_member_delete_policy" ON public.trip_member
    FOR DELETE
    USING (
        -- ผู้ใช้สามารถลบได้ถ้าเป็นผู้สร้างทริป หรือกำลังลบตัวเองออกจากทริป (สามารถลบได้แม้จะไม่ active แล้ว)
        public.check_trip_creator_access(trip_member.trip_id, auth.uid())
        OR
        user_id = auth.uid()
    );

-- ขั้นตอนที่ 7: เปิดใช้งาน RLS ถ้ายังไม่ได้เปิด
ALTER TABLE public.trip_member ENABLE ROW LEVEL SECURITY;

-- ขั้นตอนที่ 8: ตรวจสอบการทำงาน
SELECT 'แก้ไข RLS policies ของ trip_member เสร็จสิ้นแล้ว - ไม่มี recursion' as status;

-- แสดง policies ที่ติดตั้งแล้วเพื่อยืนยัน
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
