import { redirect } from 'next/navigation';
import { createClient, getAuthedUser } from '@/lib/supabase/server';
import DashboardList from '@/components/DashboardList';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getAuthedUser();
  if (!user) redirect('/login?next=/dashboard');

  const supabase = createClient();
  const { data: flights, error } = await supabase
    .from('tracked_flights')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">My Tracked Flights</h1>
      <p className="mb-6 text-sm text-slate-500">Signed in as {user.email}</p>

      {error ? (
        <div className="card p-6 text-sm text-rise">
          Couldn't connect to Supabase. Make sure your <code>NEXT_PUBLIC_SUPABASE_URL</code> /{' '}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are set and you've run{' '}
          <code>supabase/schema.sql</code> in the SQL Editor.
        </div>
      ) : (
        <DashboardList initialFlights={flights} />
      )}
    </div>
  );
}
