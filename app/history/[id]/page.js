import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient, getAuthedUser } from '@/lib/supabase/server';
import PriceChart from '@/components/PriceChart';

export const dynamic = 'force-dynamic';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function HistoryPage({ params }) {
  const user = await getAuthedUser();
  if (!user) redirect(`/login?next=/history/${params.id}`);

  const id = Number(params.id);
  const supabase = createClient();

  const { data: flight, error } = await supabase
    .from('tracked_flights')
    .select('*, price_history(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  // Not found OR belongs to someone else (RLS returns no row either way) —
  // both surface as a plain 404, never leaking whether the flight exists.
  if (error || !flight) notFound();

  flight.price_history.sort((a, b) => new Date(a.checked_at) - new Date(b.checked_at));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/dashboard" className="mb-6 inline-block text-sm text-brand hover:underline">
        ← Back to dashboard
      </Link>

      <div className="card p-6">
        <h1 className="text-xl font-bold text-slate-900">
          {flight.origin} → {flight.destination}
        </h1>
        <p className="text-sm text-slate-500">
          Departs {formatDate(flight.departure_date)}
          {flight.return_date ? ` · Returns ${formatDate(flight.return_date)}` : ''}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-slate-500">Current Price</div>
            <div className="text-lg font-bold text-slate-900">
              ₹{flight.current_price.toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Target Price</div>
            <div className="text-lg font-bold text-slate-900">
              ₹{flight.target_price.toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Lowest Price</div>
            <div className="text-lg font-bold text-slate-900">
              ₹{flight.lowest_price.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <PriceChart history={flight.price_history} targetPrice={flight.target_price} />
        </div>
      </div>
    </div>
  );
}
