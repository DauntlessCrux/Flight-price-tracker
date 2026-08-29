import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server-side Supabase client — used in server components, route handlers,
// and the auth middleware. Reads/writes the auth session via cookies so
// `supabase.auth.getUser()` reflects whoever is logged in on this request.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no request context to
            // write to — safe to ignore as long as middleware also
            // refreshes the session (see middleware.js).
          }
        },
      },
    }
  );
}

/**
 * Convenience helper for API routes / server components: returns the
 * authenticated user, or null. Never trust a user id passed in from the
 * client — always derive it from the session via this function.
 */
export async function getAuthedUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
