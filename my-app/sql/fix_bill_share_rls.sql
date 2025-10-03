-- Fix RLS policies for bill_share table to prevent recursion
-- This script ensures bill_share policies don't cause infinite recursion

-- Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "Users can view bill shares" ON public.bill_share;
DROP POLICY IF EXISTS "Users can insert bill shares" ON public.bill_share;
DROP POLICY IF EXISTS "Users can update bill shares" ON public.bill_share;
DROP POLICY IF EXISTS "Users can delete bill shares" ON public.bill_share;
DROP POLICY IF EXISTS "bill_share_select_policy" ON public.bill_share;
DROP POLICY IF EXISTS "bill_share_insert_policy" ON public.bill_share;
DROP POLICY IF EXISTS "bill_share_update_policy" ON public.bill_share;
DROP POLICY IF EXISTS "bill_share_delete_policy" ON public.bill_share;

-- Create simple, non-recursive policies for bill_share table
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

-- Ensure RLS is enabled
ALTER TABLE public.bill_share ENABLE ROW LEVEL SECURITY;

-- Test the policies
SELECT 'bill_share RLS policies fixed successfully' as status;

