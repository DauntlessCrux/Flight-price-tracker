import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// The `matcher` below is what actually limits which requests this file
// runs on — Next.js only invokes the middleware function for paths that
// match it. Scoping this to ONLY the protected routes (instead of
// "everything except static assets") means public pages like Home,
// Search, and the API routes never pay for a network round-trip to
// Supabase's auth server just to render. That round-trip on every request
// was the main cause of the site feeling slow.
export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // This call refreshes the auth token if needed — skipping it can cause
  // users to get randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/history/:path*'],
};
