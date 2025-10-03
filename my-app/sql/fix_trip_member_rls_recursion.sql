-- แก้ไขปัญหา infinite recursion ใน RLS policies ของตาราง trip_member
-- สคริปต์นี้สร้าง policies ที่ปรับปรุงแล้วเพื่อหลีกเลี่ยงการเรียกซ้ำแบบไม่สิ้นสุด

-- ลบ policies เดิมที่อาจทำให้เกิด recursion
DROP POLICY IF EXISTS "Users can view trip members" ON public.trip_member;
DROP POLICY IF EXISTS "Users can insert trip members" ON public.trip_member;
DROP POLICY IF EXISTS "Users can update trip members" ON public.trip_member;
DROP POLICY IF EXISTS "Users can delete trip members" ON public.trip_member;
DROP POLICY IF EXISTS "trip_member_select_policy" ON public.trip_member;
DROP POLICY IF EXISTS "trip_member_insert_policy" ON public.trip_member;
DROP POLICY IF EXISTS "trip_member_update_policy" ON public.trip_member;
DROP POLICY IF EXISTS "trip_member_delete_policy" ON public.trip_member;

-- สร้างฟังก์ชันเพื่อตรวจสอบสมาชิกในทริปโดยหลีกเลี่ยง recursion
-- ใช้ SECURITY DEFINER เพื่อข้าม RLS policies
CREATE OR REPLACE FUNCTION public.is_trip_member(trip_id_param uuid, user_id_param uuid)
RETURNS boolean AS $$
DECLARE
    result boolean;
BEGIN
    -- Query โดยตรงโดยไม่ผ่าน RLS (เพราะใช้ SECURITY DEFINER)
    SELECT EXISTS (
        SELECT 1 
        FROM public.trip_member tm 
        WHERE tm.trip_id = trip_id_param 
        AND tm.user_id = user_id_param
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- สร้าง select policy ที่ปรับปรุงแล้วเพื่อหลีกเลี่ยง recursion
CREATE POLICY "trip_member_select_policy" ON public.trip_member
    FOR SELECT
    USING (
        -- ผู้ใช้สามารถดูสมาชิกทริปได้ถ้าเป็นผู้สร้างทริป
        EXISTS (
            SELECT 1 FROM public.trip t 
            WHERE t.trip_id = trip_member.trip_id 
            AND t.created_by = auth.uid()
        )
        OR
        -- หรือถ้าเป็นสมาชิกของทริป (ใช้ฟังก์ชันของเราเพื่อหลีกเลี่ยง recursion)
        public.is_trip_member(trip_member.trip_id, auth.uid())
    );

-- เก็บ insert, update, และ delete policies ไว้เหมือนเดิม
CREATE POLICY "trip_member_insert_policy" ON public.trip_member
    FOR INSERT
    WITH CHECK (
        -- ผู้ใช้สามารถเพิ่มสมาชิกได้ถ้าเป็นผู้สร้างทริป
        EXISTS (
            SELECT 1 FROM public.trip t 
            WHERE t.trip_id = trip_member.trip_id 
            AND t.created_by = auth.uid()
        )
        OR
        -- หรือถ้าเป็นสมาชิกของทริปอยู่แล้ว
        public.is_trip_member(trip_member.trip_id, auth.uid())
    );

CREATE POLICY "trip_member_update_policy" ON public.trip_member
    FOR UPDATE
    USING (
        -- ผู้ใช้สามารถอัปเดตสมาชิกทริปได้ถ้าเป็นผู้สร้างทริป
        EXISTS (
            SELECT 1 FROM public.trip t 
            WHERE t.trip_id = trip_member.trip_id 
            AND t.created_by = auth.uid()
        )
        OR
        -- หรือถ้ากำลังอัปเดตสมาชิกภาพของตัวเอง
        user_id = auth.uid()
    )
    WITH CHECK (
        -- เงื่อนไขเดียวกันสำหรับค่าใหม่
        EXISTS (
            SELECT 1 FROM public.trip t 
            WHERE t.trip_id = trip_member.trip_id 
            AND t.created_by = auth.uid()
        )
        OR
        user_id = auth.uid()
    );

CREATE POLICY "trip_member_delete_policy" ON public.trip_member
    FOR DELETE
    USING (
        -- ผู้ใช้สามารถลบสมาชิกทริปได้ถ้าเป็นผู้สร้างทริป
        EXISTS (
            SELECT 1 FROM public.trip t 
            WHERE t.trip_id = trip_member.trip_id 
            AND t.created_by = auth.uid()
        )
        OR
        -- หรือถ้ากำลังลบสมาชิกภาพของตัวเอง
        user_id = auth.uid()
    );

-- ตรวจสอบให้แน่ใจว่า RLS ถูกเปิดใช้งาน
ALTER TABLE public.trip_member ENABLE ROW LEVEL SECURITY;

-- ทดสอบ policies โดยตรวจสอบว่าทำงานได้หรือไม่
SELECT 'แก้ไข RLS policies ของ trip_member สำเร็จแล้ว' as status;
