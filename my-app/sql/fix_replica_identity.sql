-- Fix replica identity for friend_requests table
-- This resolves the error: "cannot update table \"friend_requests\" because it does not have a replica identity and publishes updates"

-- Set replica identity to DEFAULT (uses primary key for row identification)
-- This is the most common and efficient setting for tables with primary keys
ALTER TABLE public.friend_requests REPLICA IDENTITY DEFAULT;

-- Alternative options (uncomment if needed):
-- REPLICA IDENTITY FULL - uses all columns (more verbose but always works)
-- ALTER TABLE public.friend_requests REPLICA IDENTITY FULL;

-- If you have a specific unique index you want to use:
-- ALTER TABLE public.friend_requests REPLICA IDENTITY USING INDEX index_name;

-- Verify the replica identity setting (using pg_class instead of pg_tables)
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
