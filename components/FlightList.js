'use client';

import { useMemo, useState } from 'react';
import FlightCard from './FlightCard';

export default function FlightList({ flights, search }) {
  const [filter, setFilter] = useState('cheapest'); // cheapest | nonstop | shortest

  const filtered = useMemo(() => {
    let list = [...flights];
    if (filter === 'nonstop') list = list.filter((f) => f.stops === 0);
    if (filter === 'cheapest') list = list.sort((a, b) => a.price - b.price);
    if (filter === 'shortest') {
      list = list
        .filter((f) => f.durationMinutes != null)
        .sort((a, b) => a.durationMinutes - b.durationMinutes);
    }
    return list;
  }, [flights, filter]);

  const filters = [
    { id: 'cheapest', label: 'Cheapest' },
    { id: 'nonstop', label: 'Non-stop' },
    { id: 'shortest', label: 'Shortest' },
  ];

  if (!flights.length) {
    return (
      <div className="card p-8 text-center text-slate-500">
        No flights found for this route and date. Try different dates or a more common route.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === f.id
                ? 'bg-brand text-white'
                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((flight) => (
          <FlightCard key={flight.id} flight={flight} search={search} />
        ))}
      </div>
    </div>
  );
}
