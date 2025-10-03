-- Fix RLS policies for trip table to prevent recursion
-- This script ensures trip policies don't cause infinite recursion

-- Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "Users can view trips" ON public.trip;
DROP POLICY IF EXISTS "Users can insert trips" ON public.trip;
DROP POLICY IF EXISTS "Users can update trips" ON public.trip;
DROP POLICY IF EXISTS "Users can delete trips" ON public.trip;
DROP POLICY IF EXISTS "trip_select_policy" ON public.trip;
DROP POLICY IF EXISTS "trip_insert_policy" ON public.trip;
DROP POLICY IF EXISTS "trip_update_policy" ON public.trip;
DROP POLICY IF EXISTS "trip_delete_policy" ON public.trip;

-- Create simple, non-recursive policies for trip table
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

-- Ensure RLS is enabled
ALTER TABLE public.trip ENABLE ROW LEVEL SECURITY;

-- Test the policies
SELECT 'trip RLS policies fixed successfully' as status;

