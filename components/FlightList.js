'use client';

import { useMemo, useState } from 'react';
import FlightCard from './FlightCard';

function formatDuration(mins) {
  if (mins == null) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

// A stable key identifying "the same outbound flight" across itineraries
// that share it but differ in their return leg.
function outboundKey(flight) {
  return `${flight.flightNumber || flight.airline}-${flight.departureDate}-${flight.departureTime}`;
}

function OutboundOption({ flight, cheapestPrice, onSelect }) {
  const duration = formatDuration(flight.durationMinutes);
  return (
    <button
      onClick={onSelect}
      className="card flex w-full flex-col gap-3 p-5 text-left transition hover:border-brand sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {flight.airline}
          {flight.flightNumber && (
            <span className="text-xs font-normal text-slate-400">{flight.flightNumber}</span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
          <span>
            {new Date(flight.departureDate).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
          {flight.departureTime && (
            <>
              <span className="text-slate-400">·</span>
              <span className="font-medium text-slate-900">{flight.departureTime}</span>
              {flight.arrivalTime && (
                <>
                  <span className="text-slate-300">→</span>
                  <span className="font-medium text-slate-900">{flight.arrivalTime}</span>
                </>
              )}
            </>
          )}
          {duration && (
            <>
              <span className="text-slate-400">·</span>
              <span>{duration}</span>
            </>
          )}
          {flight.stops != null && (
            <>
              <span className="text-slate-400">·</span>
              <span>{flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop`}</span>
            </>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs text-slate-400">Round trip from</div>
        <div className="text-lg font-bold text-slate-900">
          ₹{cheapestPrice.toLocaleString('en-IN')}
        </div>
      </div>
    </button>
  );
}

export default function FlightList({ flights, search }) {
  const [filter, setFilter] = useState('cheapest'); // cheapest | nonstop | shortest
  const [selectedOutbound, setSelectedOutbound] = useState(null);

  const isRoundTrip = flights.some((f) => f.isRoundTrip);

  // Group itineraries by their outbound flight, so the user picks the
  // outbound first, then only sees the return options that actually pair
  // with it — rather than one bundled "outbound + a specific return" card
  // that hides the choice of return flight entirely.
  const outboundGroups = useMemo(() => {
    if (!isRoundTrip) return [];
    const groups = new Map();
    for (const flight of flights) {
      const key = outboundKey(flight);
      if (!groups.has(key)) {
        groups.set(key, { key, outbound: flight, itineraries: [] });
      }
      groups.get(key).itineraries.push(flight);
    }
    return Array.from(groups.values())
      .map((g) => ({
        ...g,
        cheapestPrice: Math.min(...g.itineraries.map((f) => f.price)),
      }))
      .sort((a, b) => a.cheapestPrice - b.cheapestPrice);
  }, [flights, isRoundTrip]);

  const selectedGroup = outboundGroups.find((g) => g.key === selectedOutbound);

  const filtered = useMemo(() => {
    const source = isRoundTrip ? selectedGroup?.itineraries || [] : flights;
    let list = [...source];
    // In step 2 the outbound is already fixed (identical across every item
    // in this group), so "non-stop"/"shortest" should describe the RETURN
    // leg — that's the thing actually varying between these options.
    const stopsField = isRoundTrip ? 'returnStops' : 'stops';
    const durationField = isRoundTrip ? 'returnDurationMinutes' : 'durationMinutes';

    if (filter === 'nonstop') list = list.filter((f) => f[stopsField] === 0);
    if (filter === 'cheapest') list = list.sort((a, b) => a.price - b.price);
    if (filter === 'shortest') {
      list = list
        .filter((f) => f[durationField] != null)
        .sort((a, b) => a[durationField] - b[durationField]);
    }
    return list;
  }, [flights, filter, isRoundTrip, selectedGroup]);

  const filters = isRoundTrip
    ? [
        { id: 'cheapest', label: 'Cheapest' },
        { id: 'nonstop', label: 'Non-stop return' },
        { id: 'shortest', label: 'Shortest return' },
      ]
    : [
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

  // ─── Round trip, step 1: choose the outbound flight ───────────────
  if (isRoundTrip && !selectedGroup) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-slate-700">
          1. Choose your outbound flight — you'll pick the return flight next.
        </p>
        <div className="space-y-3">
          {outboundGroups.map((group) => (
            <OutboundOption
              key={group.key}
              flight={group.outbound}
              cheapestPrice={group.cheapestPrice}
              onSelect={() => setSelectedOutbound(group.key)}
            />
          ))}
        </div>
      </div>
    );
  }

  // ─── Round trip, step 2: choose the return flight ──────────────────
  // ─── One-way: the original single-step list ────────────────────────
  return (
    <div className="space-y-4">
      {isRoundTrip && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">
            2. Choose your return flight for the {selectedGroup.outbound.airline}{' '}
            {selectedGroup.outbound.departureTime} outbound.
          </p>
          <button
            onClick={() => setSelectedOutbound(null)}
            className="text-sm font-medium text-brand hover:underline"
          >
            ← Change outbound flight
          </button>
        </div>
      )}

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
