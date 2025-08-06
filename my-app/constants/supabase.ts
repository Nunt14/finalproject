import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kiwketmokykkyotpwdmm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpd2tldG1va3lra3lvdHB3ZG1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2OTI0MTMsImV4cCI6MjA2OTI2ODQxM30.meC3vFGhBDCj4DF66ITDNNEUlsRIt4d1UOldBpiwGyw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
