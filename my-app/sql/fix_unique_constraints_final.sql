-- Fix unique constraints for user table
-- This script ensures proper unique constraints are in place

-- Check current constraints
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
    AND tc.table_name = 'user'
ORDER BY tc.constraint_type, tc.constraint_name;

-- Drop existing unique constraints if they exist
ALTER TABLE public.user DROP CONSTRAINT IF EXISTS user_email_unique;
ALTER TABLE public.user DROP CONSTRAINT IF EXISTS user_user_id_unique;

-- Add proper unique constraints
ALTER TABLE public.user 
ADD CONSTRAINT user_email_unique UNIQUE (email);

ALTER TABLE public.user 
ADD CONSTRAINT user_user_id_unique UNIQUE (user_id);

-- Verify constraints are created
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
    AND tc.table_name = 'user'
ORDER BY tc.constraint_type, tc.constraint_name;
