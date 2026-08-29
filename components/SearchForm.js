'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AirportAutocomplete from './AirportAutocomplete';

function todayPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function SearchForm({ initial = {} }) {
  const router = useRouter();
  const [origin, setOrigin] = useState({
    code: initial.origin || 'GAU',
    label: initial.originLabel || (initial.origin ? initial.origin : 'Guwahati (GAU)'),
  });
  const [destination, setDestination] = useState({
    code: initial.destination || 'DEL',
    label: initial.destinationLabel || (initial.destination ? initial.destination : 'Delhi (DEL)'),
  });
  const [departureDate, setDepartureDate] = useState(initial.departureDate || todayPlusDays(14));
  const [returnDate, setReturnDate] = useState(initial.returnDate || todayPlusDays(21));
  const [passengers, setPassengers] = useState(initial.passengers || 1);
  const [error, setError] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();

    if (!origin.code || !destination.code) {
      setError('Please pick an airport from the suggestions for both From and To.');
      return;
    }
    setError(null);

    const params = new URLSearchParams({
      origin: origin.code,
      destination: destination.code,
      departureDate,
      returnDate,
      passengers: String(passengers),
    });
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-5">
      <div className="lg:col-span-1">
        <AirportAutocomplete
          label="From"
          value={origin}
          onChange={setOrigin}
          placeholder="City or airport code"
        />
      </div>

      <div className="lg:col-span-1">
        <AirportAutocomplete
          label="To"
          value={destination}
          onChange={setDestination}
          placeholder="City or airport code"
        />
      </div>

      <div className="lg:col-span-1">
        <label className="mb-1 block text-xs font-semibold text-slate-500">Departure</label>
        <input
          type="date"
          className="input"
          value={departureDate}
          onChange={(e) => setDepartureDate(e.target.value)}
          required
        />
      </div>

      <div className="lg:col-span-1">
        <label className="mb-1 block text-xs font-semibold text-slate-500">Return</label>
        <input
          type="date"
          className="input"
          value={returnDate}
          onChange={(e) => setReturnDate(e.target.value)}
        />
      </div>

      <div className="flex items-end gap-3 lg:col-span-1">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Passengers</label>
          <input
            type="number"
            min={1}
            max={9}
            className="input"
            value={passengers}
            onChange={(e) => setPassengers(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary h-[42px] flex-1">
          Search
        </button>
      </div>

      {error && <p className="text-sm text-rise sm:col-span-2 lg:col-span-5">{error}</p>}
    </form>
  );
}
