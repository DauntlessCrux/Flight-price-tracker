import { createClient } from '@supabase/supabase-js';

// Service-role client — bypasses Row Level Security ON PURPOSE, because
// the cron job needs to read and update every user's tracked flights, not
// just one session's. Only ever import this from trusted server-only code
// (the cron route). Never from a client component, and never expose
// SUPABASE_SERVICE_ROLE_KEY with a NEXT_PUBLIC_ prefix.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
