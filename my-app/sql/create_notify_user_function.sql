-- Create the notify_user function that's missing
-- This function creates notifications for users

CREATE OR REPLACE FUNCTION public.notify_user(
    p_user_id UUID,
    p_title VARCHAR(255),
    p_message TEXT,
    p_trip_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        sender_id,
        trip_id
    ) VALUES (
        p_user_id,
        'friend_request',
        p_title,
        p_message,
        auth.uid(),
        p_trip_id
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.notify_user(UUID, VARCHAR(255), TEXT, UUID) TO authenticated;

-- Optional: Also create a simpler version without trip_id for backward compatibility
CREATE OR REPLACE FUNCTION public.notify_user(
    p_user_id UUID,
    p_title VARCHAR(255),
    p_message TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        sender_id,
        trip_id
    ) VALUES (
        p_user_id,
        'friend_request',
        p_title,
        p_message,
        auth.uid(),
        NULL
    );
END;
$$;

-- Grant execute permission for the simpler version too
GRANT EXECUTE ON FUNCTION public.notify_user(UUID, VARCHAR(255), TEXT) TO authenticated;
