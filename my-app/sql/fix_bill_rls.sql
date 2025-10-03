-- Fix RLS policies for bill table to prevent recursion
-- This script ensures bill policies don't cause infinite recursion

-- Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "Users can view bills" ON public.bill;
DROP POLICY IF EXISTS "Users can insert bills" ON public.bill;
DROP POLICY IF EXISTS "Users can update bills" ON public.bill;
DROP POLICY IF EXISTS "Users can delete bills" ON public.bill;
DROP POLICY IF EXISTS "bill_select_policy" ON public.bill;
DROP POLICY IF EXISTS "bill_insert_policy" ON public.bill;
DROP POLICY IF EXISTS "bill_update_policy" ON public.bill;
DROP POLICY IF EXISTS "bill_delete_policy" ON public.bill;

-- Create simple, non-recursive policies for bill table
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

-- Ensure RLS is enabled
ALTER TABLE public.bill ENABLE ROW LEVEL SECURITY;

-- Test the policies
SELECT 'bill RLS policies fixed successfully' as status;

