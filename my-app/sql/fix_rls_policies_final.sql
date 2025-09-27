-- Fix RLS policies for user table - Final version
-- This script removes conflicting policies and creates clean, working policies

-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Allow user registration" ON public.user;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user;
DROP POLICY IF EXISTS "Users can upsert their own profile" ON public.user;
DROP POLICY IF EXISTS "Users can view other profiles" ON public.user;

-- Create clean, non-conflicting RLS policies

-- Policy 1: Allow INSERT for new user registration (no restrictions)
CREATE POLICY "Allow new user registration" ON public.user
  FOR INSERT WITH CHECK (true);

-- Policy 2: Allow users to view their own profile
CREATE POLICY "Users can view their own profile" ON public.user
  FOR SELECT USING (auth.uid() = user_id);

-- Policy 3: Allow users to update their own profile
CREATE POLICY "Users can update their own profile" ON public.user
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy 4: Allow users to view other profiles (for trip members, etc.)
CREATE POLICY "Users can view other profiles" ON public.user
  FOR SELECT USING (true);

-- Verify policies are created correctly
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
WHERE tablename = 'user' 
ORDER BY policyname;
