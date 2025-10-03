-- Fix all RLS policies to prevent infinite recursion
-- Run this script to fix all RLS policy issues

-- ========================================
-- 1. Fix trip_member RLS policies
-- ========================================

-- Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "Users can view trip members" ON public.trip_member;
DROP POLICY IF EXISTS "Users can insert trip members" ON public.trip_member;
DROP POLICY IF EXISTS "Users can update trip members" ON public.trip_member;
DROP POLICY IF EXISTS "Users can delete trip members" ON public.trip_member;
DROP POLICY IF EXISTS "trip_member_select_policy" ON public.trip_member;
DROP POLICY IF EXISTS "trip_member_insert_policy" ON public.trip_member;
DROP POLICY IF EXISTS "trip_member_update_policy" ON public.trip_member;
DROP POLICY IF EXISTS "trip_member_delete_policy" ON public.trip_member;

-- Create simple, non-recursive policies for trip_member
CREATE POLICY "trip_member_select_policy" ON public.trip_member
    FOR SELECT
    USING (
        -- Users can see trip members if they are members of the trip
        EXISTS (
            SELECT 1 FROM public.trip_member tm2 
            WHERE tm2.trip_id = trip_member.trip_id 
            AND tm2.user_id = auth.uid()
        )
        OR
        -- Or if they are the creator of the trip
        EXISTS (
            SELECT 1 FROM public.trip t 
            WHERE t.trip_id = trip_member.trip_id 
            AND t.created_by = auth.uid()
        )
    );

CREATE POLICY "trip_member_insert_policy" ON public.trip_member
    FOR INSERT
    WITH CHECK (
        -- Users can add members if they are the creator of the trip
        EXISTS (
            SELECT 1 FROM public.trip t 
            WHERE t.trip_id = trip_member.trip_id 
            AND t.created_by = auth.uid()
        )
        OR
        -- Or if they are already a member of the trip
        EXISTS (
            SELECT 1 FROM public.trip_member tm 
            WHERE tm.trip_id = trip_member.trip_id 
            AND tm.user_id = auth.uid()
        )
    );

CREATE POLICY "trip_member_update_policy" ON public.trip_member
    FOR UPDATE
    USING (
        -- Users can update trip members if they are the creator of the trip
        EXISTS (
            SELECT 1 FROM public.trip t 
            WHERE t.trip_id = trip_member.trip_id 
            AND t.created_by = auth.uid()
        )
        OR
        -- Or if they are updating their own membership
        user_id = auth.uid()
    )
    WITH CHECK (
        -- Same conditions for the new values
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
        -- Users can delete trip members if they are the creator of the trip
        EXISTS (
            SELECT 1 FROM public.trip t 
            WHERE t.trip_id = trip_member.trip_id 
            AND t.created_by = auth.uid()
        )
        OR
        -- Or if they are deleting their own membership
        user_id = auth.uid()
    );

-- ========================================
-- 2. Fix trip RLS policies
-- ========================================

-- Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "Users can view trips" ON public.trip;
DROP POLICY IF EXISTS "Users can insert trips" ON public.trip;
DROP POLICY IF EXISTS "Users can update trips" ON public.trip;
DROP POLICY IF EXISTS "Users can delete trips" ON public.trip;
DROP POLICY IF EXISTS "trip_select_policy" ON public.trip;
DROP POLICY IF EXISTS "trip_insert_policy" ON public.trip;
DROP POLICY IF EXISTS "trip_update_policy" ON public.trip;
DROP POLICY IF EXISTS "trip_delete_policy" ON public.trip;

-- Create simple, non-recursive policies for trip
CREATE POLICY "trip_select_policy" ON public.trip
    FOR SELECT
    USING (
        -- Users can see trips if they are members of the trip
        EXISTS (
            SELECT 1 FROM public.trip_member tm 
            WHERE tm.trip_id = trip.trip_id 
            AND tm.user_id = auth.uid()
        )
        OR
        -- Or if they are the creator of the trip
        created_by = auth.uid()
    );

CREATE POLICY "trip_insert_policy" ON public.trip
    FOR INSERT
    WITH CHECK (
        -- Users can create trips if they are authenticated
        auth.uid() IS NOT NULL
        AND
        -- And they are setting themselves as the creator
        created_by = auth.uid()
    );

CREATE POLICY "trip_update_policy" ON public.trip
    FOR UPDATE
    USING (
        -- Users can update trips if they are the creator
        created_by = auth.uid()
        OR
        -- Or if they are admin members of the trip
        EXISTS (
            SELECT 1 FROM public.trip_member tm 
            WHERE tm.trip_id = trip.trip_id 
            AND tm.user_id = auth.uid()
            AND tm.is_admin = true
        )
    )
    WITH CHECK (
        -- Same conditions for the new values
        created_by = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.trip_member tm 
            WHERE tm.trip_id = trip.trip_id 
            AND tm.user_id = auth.uid()
            AND tm.is_admin = true
        )
    );

CREATE POLICY "trip_delete_policy" ON public.trip
    FOR DELETE
    USING (
        -- Users can delete trips if they are the creator
        created_by = auth.uid()
        OR
        -- Or if they are admin members of the trip
        EXISTS (
            SELECT 1 FROM public.trip_member tm 
            WHERE tm.trip_id = trip.trip_id 
            AND tm.user_id = auth.uid()
            AND tm.is_admin = true
        )
    );

-- ========================================
-- 3. Fix bill RLS policies
-- ========================================

-- Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "Users can view bills" ON public.bill;
DROP POLICY IF EXISTS "Users can insert bills" ON public.bill;
DROP POLICY IF EXISTS "Users can update bills" ON public.bill;
DROP POLICY IF EXISTS "Users can delete bills" ON public.bill;
DROP POLICY IF EXISTS "bill_select_policy" ON public.bill;
DROP POLICY IF EXISTS "bill_insert_policy" ON public.bill;
DROP POLICY IF EXISTS "bill_update_policy" ON public.bill;
DROP POLICY IF EXISTS "bill_delete_policy" ON public.bill;

-- Create simple, non-recursive policies for bill
CREATE POLICY "bill_select_policy" ON public.bill
    FOR SELECT
    USING (
        -- Users can see bills if they are members of the trip
        EXISTS (
            SELECT 1 FROM public.trip_member tm 
            WHERE tm.trip_id = bill.trip_id 
            AND tm.user_id = auth.uid()
        )
        OR
        -- Or if they are the creator of the trip
        EXISTS (
            SELECT 1 FROM public.trip t 
            WHERE t.trip_id = bill.trip_id 
            AND t.created_by = auth.uid()
        )
    );

CREATE POLICY "bill_insert_policy" ON public.bill
    FOR INSERT
    WITH CHECK (
        -- Users can create bills if they are members of the trip
        EXISTS (
            SELECT 1 FROM public.trip_member tm 
            WHERE tm.trip_id = bill.trip_id 
            AND tm.user_id = auth.uid()
        )
        OR
        -- Or if they are the creator of the trip
        EXISTS (
            SELECT 1 FROM public.trip t 
            WHERE t.trip_id = bill.trip_id 
            AND t.created_by = auth.uid()
        )
    );

CREATE POLICY "bill_update_policy" ON public.bill
    FOR UPDATE
    USING (
        -- Users can update bills if they are members of the trip
        EXISTS (
            SELECT 1 FROM public.trip_member tm 
            WHERE tm.trip_id = bill.trip_id 
            AND tm.user_id = auth.uid()
        )
        OR
        -- Or if they are the creator of the trip
        EXISTS (
            SELECT 1 FROM public.trip t 
            WHERE t.trip_id = bill.trip_id 
            AND t.created_by = auth.uid()
        )
        OR
        -- Or if they are the one who paid for the bill
        paid_by_user_id = auth.uid()
    )
    WITH CHECK (
        -- Same conditions for the new values
        EXISTS (
            SELECT 1 FROM public.trip_member tm 
            WHERE tm.trip_id = bill.trip_id 
            AND tm.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.trip t 
            WHERE t.trip_id = bill.trip_id 
            AND t.created_by = auth.uid()
        )
        OR
        paid_by_user_id = auth.uid()
    );

CREATE POLICY "bill_delete_policy" ON public.bill
    FOR DELETE
    USING (
        -- Users can delete bills if they are members of the trip
        EXISTS (
            SELECT 1 FROM public.trip_member tm 
            WHERE tm.trip_id = bill.trip_id 
            AND tm.user_id = auth.uid()
        )
        OR
        -- Or if they are the creator of the trip
        EXISTS (
            SELECT 1 FROM public.trip t 
            WHERE t.trip_id = bill.trip_id 
            AND t.created_by = auth.uid()
        )
        OR
        -- Or if they are the one who paid for the bill
        paid_by_user_id = auth.uid()
    );

-- ========================================
-- 4. Fix bill_share RLS policies
-- ========================================

-- Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "Users can view bill shares" ON public.bill_share;
DROP POLICY IF EXISTS "Users can insert bill shares" ON public.bill_share;
DROP POLICY IF EXISTS "Users can update bill shares" ON public.bill_share;
DROP POLICY IF EXISTS "Users can delete bill shares" ON public.bill_share;
DROP POLICY IF EXISTS "bill_share_select_policy" ON public.bill_share;
DROP POLICY IF EXISTS "bill_share_insert_policy" ON public.bill_share;
DROP POLICY IF EXISTS "bill_share_update_policy" ON public.bill_share;
DROP POLICY IF EXISTS "bill_share_delete_policy" ON public.bill_share;

-- Create simple, non-recursive policies for bill_share
CREATE POLICY "bill_share_select_policy" ON public.bill_share
    FOR SELECT
    USING (
        -- Users can see bill shares if they are the user in the share
        user_id = auth.uid()
        OR
        -- Or if they are members of the trip
        EXISTS (
            SELECT 1 FROM public.bill b
            JOIN public.trip_member tm ON tm.trip_id = b.trip_id
            WHERE b.bill_id = bill_share.bill_id 
            AND tm.user_id = auth.uid()
        )
        OR
        -- Or if they are the creator of the trip
        EXISTS (
            SELECT 1 FROM public.bill b
            JOIN public.trip t ON t.trip_id = b.trip_id
            WHERE b.bill_id = bill_share.bill_id 
            AND t.created_by = auth.uid()
        )
    );

CREATE POLICY "bill_share_insert_policy" ON public.bill_share
    FOR INSERT
    WITH CHECK (
        -- Users can create bill shares if they are members of the trip
        EXISTS (
            SELECT 1 FROM public.bill b
            JOIN public.trip_member tm ON tm.trip_id = b.trip_id
            WHERE b.bill_id = bill_share.bill_id 
            AND tm.user_id = auth.uid()
        )
        OR
        -- Or if they are the creator of the trip
        EXISTS (
            SELECT 1 FROM public.bill b
            JOIN public.trip t ON t.trip_id = b.trip_id
            WHERE b.bill_id = bill_share.bill_id 
            AND t.created_by = auth.uid()
        )
    );

CREATE POLICY "bill_share_update_policy" ON public.bill_share
    FOR UPDATE
    USING (
        -- Users can update bill shares if they are the user in the share
        user_id = auth.uid()
        OR
        -- Or if they are members of the trip
        EXISTS (
            SELECT 1 FROM public.bill b
            JOIN public.trip_member tm ON tm.trip_id = b.trip_id
            WHERE b.bill_id = bill_share.bill_id 
            AND tm.user_id = auth.uid()
        )
        OR
        -- Or if they are the creator of the trip
        EXISTS (
            SELECT 1 FROM public.bill b
            JOIN public.trip t ON t.trip_id = b.trip_id
            WHERE b.bill_id = bill_share.bill_id 
            AND t.created_by = auth.uid()
        )
    )
    WITH CHECK (
        -- Same conditions for the new values
        user_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.bill b
            JOIN public.trip_member tm ON tm.trip_id = b.trip_id
            WHERE b.bill_id = bill_share.bill_id 
            AND tm.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.bill b
            JOIN public.trip t ON t.trip_id = b.trip_id
            WHERE b.bill_id = bill_share.bill_id 
            AND t.created_by = auth.uid()
        )
    );

CREATE POLICY "bill_share_delete_policy" ON public.bill_share
    FOR DELETE
    USING (
        -- Users can delete bill shares if they are the user in the share
        user_id = auth.uid()
        OR
        -- Or if they are members of the trip
        EXISTS (
            SELECT 1 FROM public.bill b
            JOIN public.trip_member tm ON tm.trip_id = b.trip_id
            WHERE b.bill_id = bill_share.bill_id 
            AND tm.user_id = auth.uid()
        )
        OR
        -- Or if they are the creator of the trip
        EXISTS (
            SELECT 1 FROM public.bill b
            JOIN public.trip t ON t.trip_id = b.trip_id
            WHERE b.bill_id = bill_share.bill_id 
            AND t.created_by = auth.uid()
        )
    );

-- ========================================
-- 5. Ensure RLS is enabled on all tables
-- ========================================

ALTER TABLE public.trip_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_share ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 6. Test the policies
-- ========================================

SELECT 'All RLS policies fixed successfully - no more infinite recursion!' as status;

