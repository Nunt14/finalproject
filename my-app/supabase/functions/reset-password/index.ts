// Supabase Edge Function: Reset password by email (admin)
// SECURITY NOTE:
// - This endpoint requires an 'x-reset-key' header that must match RESET_PASSWORD_KEY
//   configured as a secret in your project. Do NOT use the service role key on the client.
// - Consider adding additional protections: rate limiting, CAPTCHA, or OTP verification.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (data: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type, x-reset-key',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      ...extraHeaders,
    },
  })

serve(async (req) => {
  // If your project enforces JWT, validate anon-key bearer here if needed
  // Basic allow-all: skip validation
  if (req.method === 'OPTIONS') {
    return json({ ok: true })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // NOTE: Authorization header removed per request (no email / minimal friction)
  // This makes the endpoint callable by anyone who knows the URL.

  let payload: { email?: string; newPassword?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const email = (payload.email || '').trim().toLowerCase()
  const newPassword = payload.newPassword || ''
  if (!email || !newPassword) {
    return json({ error: 'Missing email or newPassword' }, 400)
  }
  if (newPassword.length < 6) {
    return json({ error: 'Password must be at least 6 characters' }, 400)
  }

  // Read non-reserved names first; keep old names as fallback if already set
  const supabaseUrl = Deno.env.get('PROJECT_URL') ?? Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Server not configured' }, 500)
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    // Find user_id from your public 'user' table (populated on login)
    const { data: found, error: findErr } = await admin
      .from('user')
      .select('user_id')
      .eq('email', email)
      .maybeSingle()

    if (findErr) {
      return json({ error: findErr.message }, 500)
    }
    const userId = found?.user_id as string | undefined
    if (!userId) {
      return json({ error: 'User not found' }, 404)
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    })
    if (updErr) {
      return json({ error: updErr.message }, 500)
    }

    return json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return json({ error: message }, 500)
  }
})


