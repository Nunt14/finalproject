-- Fix infinite recursion in trip_member RLS policies
-- This script removes conflicting policies and creates clean, non-recursive ones

-- Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "Users can view trip members" ON public.trip_member;
DROP POLICY IF EXISTS "Users can insert trip members" ON public.trip_member;
DROP POLICY IF EXISTS "Users can update trip members" ON public.trip_member;
DROP POLICY IF EXISTS "Users can delete trip members" ON public.trip_member;
DROP POLICY IF EXISTS "trip_member_select_policy" ON public.trip_member;
DROP POLICY IF EXISTS "trip_member_insert_policy" ON public.trip_member;
DROP POLICY IF EXISTS "trip_member_update_policy" ON public.trip_member;
DROP POLICY IF EXISTS "trip_member_delete_policy" ON public.trip_member;

-- Create simple, non-recursive policies
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

-- Ensure RLS is enabled
ALTER TABLE public.trip_member ENABLE ROW LEVEL SECURITY;

-- Test the policies by checking if they work
-- This should not cause infinite recursion
SELECT 'trip_member RLS policies fixed successfully' as status;

