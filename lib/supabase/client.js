'use client';

// Browser-side Supabase client — used in client components (login/signup
// forms, navbar sign-out button, etc). Auth only; all real data reads/writes
// go through our own API routes, which query Supabase using the
// server-side session (see lib/supabase/server.js).

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
