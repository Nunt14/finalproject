-- Fix replica identity for friend_requests table
-- The table currently has no primary key, which is required for replica identity

-- Step 1: Add a primary key to the table (using a simple ID column)
-- This will serve as the replica identity for row identification
ALTER TABLE public.friend_requests
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() PRIMARY KEY;

-- Alternative: If you prefer to use the existing unique constraint as primary key
-- Uncomment the line below and comment out the ADD COLUMN line above
-- ALTER TABLE public.friend_requests ADD PRIMARY KEY (sender_id, receiver_id);

-- Step 2: Set replica identity to DEFAULT (uses primary key for row identification)
ALTER TABLE public.friend_requests REPLICA IDENTITY DEFAULT;

-- Step 3: Verify the replica identity setting
SELECT
    c.relname as tablename,
    CASE c.relreplident
        WHEN 'd' THEN 'DEFAULT (primary key)'
        WHEN 'f' THEN 'FULL (all columns)'
        WHEN 'i' THEN 'INDEX (using index)'
        WHEN 'n' THEN 'NOTHING'
        ELSE 'UNKNOWN'
    END as replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'friend_requests'
AND n.nspname = 'public';

-- Step 4: Verify the table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'friend_requests'
AND table_schema = 'public'
ORDER BY ordinal_position;
