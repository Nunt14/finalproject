-- Fix RLS policies for existing friend_requests and friends tables
-- Based on actual database schema provided by user
-- This fixes the "new row violates row-level security policy for table friend_requests" error

-- Enable RLS on friend_requests table
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

-- Enable RLS on friends table
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid "already exists" errors)
DROP POLICY IF EXISTS "Users can view their friend requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Users can insert friend requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Users can update their friend requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Users can delete their friend requests" ON public.friend_requests;

DROP POLICY IF EXISTS "Users can view their friendships" ON public.friends;
DROP POLICY IF EXISTS "Users can manage their friendships" ON public.friends;

-- Policy: Users can view friend requests where they are sender or receiver
CREATE POLICY "Users can view their friend requests" ON public.friend_requests
    FOR SELECT
    USING (
        auth.uid() = sender_id
        OR auth.uid() = receiver_id
    );

-- Policy: Users can insert friend requests where they are the sender
CREATE POLICY "Users can insert friend requests" ON public.friend_requests
    FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

-- Policy: Users can update friend requests where they are the receiver (for accepting/declining)
CREATE POLICY "Users can update their friend requests" ON public.friend_requests
    FOR UPDATE
    USING (auth.uid() = receiver_id)
    WITH CHECK (auth.uid() = receiver_id);

-- Policy: Users can delete friend requests where they are sender or receiver
CREATE POLICY "Users can delete their friend requests" ON public.friend_requests
    FOR DELETE
    USING (
        auth.uid() = sender_id
        OR auth.uid() = receiver_id
    );

-- Policy: Users can view friendships where they are one of the users
CREATE POLICY "Users can view their friendships" ON public.friends
    FOR SELECT
    USING (
        auth.uid() = user_one_id
        OR auth.uid() = user_two_id
    );

-- Policy: Users can insert friendships where they are one of the users
CREATE POLICY "Users can manage their friendships" ON public.friends
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_one_id
        OR auth.uid() = user_two_id
    );

-- Policy: Users can delete friendships where they are one of the users
CREATE POLICY "Users can delete their friendships" ON public.friends
    FOR DELETE
    USING (
        auth.uid() = user_one_id
        OR auth.uid() = user_two_id
    );

-- Add comments for documentation
COMMENT ON TABLE public.friend_requests IS 'ตารางเก็บคำขอเป็นเพื่อนระหว่างผู้ใช้';
COMMENT ON COLUMN public.friend_requests.sender_id IS 'ผู้ใช้ที่ส่งคำขอเป็นเพื่อน';
COMMENT ON COLUMN public.friend_requests.receiver_id IS 'ผู้ใช้ที่รับคำขอเป็นเพื่อน';
COMMENT ON COLUMN public.friend_requests.status IS 'สถานะคำขอ: pending, accepted, declined, cancelled';
COMMENT ON COLUMN public.friend_requests.pair_key IS 'คีย์รวมของ sender_id และ receiver_id สำหรับการค้นหา';

COMMENT ON TABLE public.friends IS 'ตารางเก็บความสัมพันธ์เพื่อนแบบสองทิศทาง';
COMMENT ON COLUMN public.friends.user_one_id IS 'ผู้ใช้คนแรกในความสัมพันธ์';
COMMENT ON COLUMN public.friends.user_two_id IS 'ผู้ใช้คนที่สองในความสัมพันธ์';
