'use client';

import { useState } from 'react';
import Link from 'next/link';
import TrackedFlightCard from './TrackedFlightCard';

export default function DashboardList({ initialFlights }) {
  const [flights, setFlights] = useState(initialFlights);

  function handleRemoved(id) {
    setFlights((prev) => prev.filter((f) => f.id !== id));
  }

  async function refreshOne(id) {
    try {
      const res = await fetch(`/api/tracked/${id}`);
      const data = await res.json();
      if (res.ok) {
        setFlights((prev) => prev.map((f) => (f.id === id ? data.trackedFlight : f)));
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (!flights.length) {
    return (
      <div className="card p-10 text-center">
        <p className="text-slate-600">You're not tracking any flights yet.</p>
        <Link href="/search" className="btn-primary mt-4 inline-flex">
          Search flights
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {flights.map((flight) => (
        <TrackedFlightCard
          key={flight.id}
          flight={flight}
          onRemoved={handleRemoved}
          onChecked={() => refreshOne(flight.id)}
        />
      ))}
    </div>
  );
}
