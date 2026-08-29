import SearchForm from '@/components/SearchForm';
import FlightList from '@/components/FlightList';
import { searchFlights } from '@/lib/rapidapi-flights';

export const dynamic = 'force-dynamic';

function todayPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function SearchPage({ searchParams }) {
  const origin = (searchParams.origin || 'GAU').toUpperCase();
  const destination = (searchParams.destination || 'DEL').toUpperCase();
  const departureDate = searchParams.departureDate || todayPlusDays(14);
  const returnDate = searchParams.returnDate || '';
  const passengers = Number(searchParams.passengers || '1');

  let flights = [];
  let error = null;

  try {
    flights = await searchFlights({ origin, destination, departureDate, returnDate });
  } catch (err) {
    error = 'Could not fetch flights right now. Please try again.';
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <SearchForm initial={{ origin, destination, departureDate, returnDate, passengers }} />

      <div className="mt-8">
        <h1 className="mb-1 text-xl font-bold text-slate-900">
          Flights from {origin} → {destination}
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          {new Date(departureDate).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          {passengers > 1 && ` · Fares shown are per adult, regardless of passenger count`}
        </p>

        {error ? (
          <div className="card p-6 text-center text-rise">{error}</div>
        ) : (
          <FlightList flights={flights} search={{ origin, destination, departureDate, returnDate }} />
        )}
      </div>
    </div>
  );
}
