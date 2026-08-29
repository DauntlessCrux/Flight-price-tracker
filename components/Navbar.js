'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoaded(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    // Full navigation, not router.push+refresh — see the same comment in
    // LoginForm.js for why this avoids a stuck-on-the-same-page state.
    window.location.assign('/');
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-brand">
          <span>✈</span>
          <span>FlightTracker</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link href="/search" className="hover:text-brand">Search</Link>
          <Link href="/dashboard" className="hover:text-brand">My Trips</Link>

          {loaded && (
            user ? (
              <div className="flex items-center gap-3">
                <span className="hidden text-xs text-slate-400 sm:inline">{user.email}</span>
                <button onClick={handleLogout} className="btn-secondary py-1.5 text-xs">
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="hover:text-brand">Log in</Link>
                <Link href="/signup" className="btn-primary py-1.5 text-xs">Sign up</Link>
              </div>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
