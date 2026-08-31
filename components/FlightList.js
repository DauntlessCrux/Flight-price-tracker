'use client';

import { useMemo, useState } from 'react';
import FlightCard from './FlightCard';

function sortFlights(flights, filter) {
  let list = [...flights];

  if (filter === 'nonstop') {
    list = list.filter((flight) => flight.stops === 0);
  }

  if (filter === 'cheapest') {
    list.sort((a, b) => a.price - b.price);
  }

  if (filter === 'shortest') {
    list = list
      .filter((flight) => flight.durationMinutes != null)
      .sort(
        (a, b) =>
          a.durationMinutes - b.durationMinutes
      );
  }

  return list;
}

export default function FlightList({ flights, search }) {
  const [filter, setFilter] = useState('cheapest');

  const [selectedOutbound, setSelectedOutbound] =
    useState(null);

  const [selectedReturn, setSelectedReturn] =
    useState(null);

  const isRoundTrip =
    flights.some((flight) => flight.tripLeg === 'outbound') &&
    flights.some((flight) => flight.tripLeg === 'return');

  // ───────────────────────────────────────────────
  // Separate outbound and return flights
  // ───────────────────────────────────────────────

  const outboundFlights = useMemo(
    () =>
      flights.filter(
        (flight) => flight.tripLeg === 'outbound'
      ),
    [flights]
  );

  const returnFlights = useMemo(
    () =>
      flights.filter(
        (flight) => flight.tripLeg === 'return'
      ),
    [flights]
  );

  // ───────────────────────────────────────────────
  // ONE-WAY
  // ───────────────────────────────────────────────

  if (!isRoundTrip) {
    const filteredFlights = sortFlights(
      flights,
      filter
    );

    if (!flights.length) {
      return (
        <div className="card p-8 text-center text-slate-500">
          No flights found for this route and date.
          Try different dates or a more common route.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {[
            { id: 'cheapest', label: 'Cheapest' },
            { id: 'nonstop', label: 'Non-stop' },
            { id: 'shortest', label: 'Shortest' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filter === item.id
                  ? 'bg-brand text-white'
                  : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredFlights.map((flight) => (
            <FlightCard
              key={flight.id}
              flight={flight}
              search={search}
            />
          ))}
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────
  // ROUND TRIP — EMPTY STATE
  // ───────────────────────────────────────────────

  if (!outboundFlights.length || !returnFlights.length) {
    return (
      <div className="card p-8 text-center text-slate-500">
        Could not find flights for both directions.
        Please try different dates.
      </div>
    );
  }

  // ───────────────────────────────────────────────
  // ROUND TRIP — STEP 1
  // ───────────────────────────────────────────────

  if (!selectedOutbound) {
    const filteredOutbound = sortFlights(
      outboundFlights,
      filter
    );

    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            1. Choose your outbound flight
          </p>

          <p className="text-sm text-slate-500">
            {search.origin} → {search.destination}
          </p>
        </div>

        <div className="flex gap-2">
          {[
            { id: 'cheapest', label: 'Cheapest' },
            { id: 'nonstop', label: 'Non-stop' },
            { id: 'shortest', label: 'Shortest' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filter === item.id
                  ? 'bg-brand text-white'
                  : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredOutbound.map((flight) => (
            <div
              key={flight.id}
              className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  {flight.airline}

                  {flight.flightNumber && (
                    <span className="text-xs font-normal text-slate-400">
                      {flight.flightNumber}
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                  <span>
                    {flight.departureTime}
                  </span>

                  <span className="text-slate-300">
                    →
                  </span>

                  <span>
                    {flight.arrivalTime}
                  </span>

                  {flight.durationMinutes != null && (
                    <>
                      <span className="text-slate-400">
                        ·
                      </span>

                      <span>
                        {Math.floor(
                          flight.durationMinutes / 60
                        )}
                        h{' '}
                        {flight.durationMinutes % 60}
                        m
                      </span>
                    </>
                  )}

                  <span className="text-slate-400">
                    ·
                  </span>

                  <span>
                    {flight.stops === 0
                      ? 'Non-stop'
                      : `${flight.stops} stop`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs text-slate-400">
                    Outbound
                  </div>

                  <div className="text-lg font-bold text-slate-900">
                    ₹
                    {flight.price.toLocaleString(
                      'en-IN'
                    )}
                  </div>
                </div>

                <button
                  onClick={() =>
                    setSelectedOutbound(flight)
                  }
                  className="btn-primary"
                >
                  Select
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────
  // ROUND TRIP — STEP 2
  // ───────────────────────────────────────────────

  if (!selectedReturn) {
    const filteredReturn = sortFlights(
      returnFlights,
      filter
    );

    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              2. Choose your return flight
            </p>

            <p className="text-sm text-slate-500">
              {search.destination} → {search.origin}
            </p>
          </div>

          <button
            onClick={() =>
              setSelectedOutbound(null)
            }
            className="text-sm font-medium text-brand hover:underline"
          >
            ← Change outbound flight
          </button>
        </div>

        {/* Selected outbound summary */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Selected outbound
          </div>

          <div className="mt-1 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-800">
                {selectedOutbound.airline}
              </div>

              <div className="text-sm text-slate-500">
                {search.origin} →{' '}
                {search.destination} ·{' '}
                {selectedOutbound.departureTime}
              </div>
            </div>

            <div className="font-bold text-slate-900">
              ₹
              {selectedOutbound.price.toLocaleString(
                'en-IN'
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {[
            { id: 'cheapest', label: 'Cheapest' },
            { id: 'nonstop', label: 'Non-stop' },
            { id: 'shortest', label: 'Shortest' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filter === item.id
                  ? 'bg-brand text-white'
                  : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredReturn.map((flight) => (
            <div
              key={flight.id}
              className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  {flight.airline}

                  {flight.flightNumber && (
                    <span className="text-xs font-normal text-slate-400">
                      {flight.flightNumber}
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                  <span>
                    {flight.departureTime}
                  </span>

                  <span className="text-slate-300">
                    →
                  </span>

                  <span>
                    {flight.arrivalTime}
                  </span>

                  {flight.durationMinutes != null && (
                    <>
                      <span className="text-slate-400">
                        ·
                      </span>

                      <span>
                        {Math.floor(
                          flight.durationMinutes / 60
                        )}
                        h{' '}
                        {flight.durationMinutes % 60}
                        m
                      </span>
                    </>
                  )}

                  <span className="text-slate-400">
                    ·
                  </span>

                  <span>
                    {flight.stops === 0
                      ? 'Non-stop'
                      : `${flight.stops} stop`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs text-slate-400">
                    Return
                  </div>

                  <div className="text-lg font-bold text-slate-900">
                    ₹
                    {flight.price.toLocaleString(
                      'en-IN'
                    )}
                  </div>
                </div>

                <button
                  onClick={() =>
                    setSelectedReturn(flight)
                  }
                  className="btn-primary"
                >
                  Select
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────
  // ROUND TRIP — BOTH SELECTED
  // ───────────────────────────────────────────────

  const total =
    selectedOutbound.price + selectedReturn.price;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-800">
          Round trip selected
        </p>

        <p className="text-sm text-slate-500">
          Both flights have been selected.
        </p>
      </div>

      <div className="space-y-3">
        <div className="card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Outbound
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-800">
                {selectedOutbound.airline}
              </div>

              <div className="text-sm text-slate-500">
                {search.origin} →{' '}
                {search.destination}
              </div>

              <div className="text-sm text-slate-500">
                {selectedOutbound.departureTime} →{' '}
                {selectedOutbound.arrivalTime}
              </div>
            </div>

            <div className="font-bold text-slate-900">
              ₹
              {selectedOutbound.price.toLocaleString(
                'en-IN'
              )}
            </div>
          </div>

          <button
            onClick={() => {
              setSelectedOutbound(null);
              setSelectedReturn(null);
            }}
            className="mt-3 text-sm font-medium text-brand hover:underline"
          >
            Change outbound flight
          </button>
        </div>

        <div className="card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Return
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-800">
                {selectedReturn.airline}
              </div>

              <div className="text-sm text-slate-500">
                {search.destination} →{' '}
                {search.origin}
              </div>

              <div className="text-sm text-slate-500">
                {selectedReturn.departureTime} →{' '}
                {selectedReturn.arrivalTime}
              </div>
            </div>

            <div className="font-bold text-slate-900">
              ₹
              {selectedReturn.price.toLocaleString(
                'en-IN'
              )}
            </div>
          </div>

          <button
            onClick={() => setSelectedReturn(null)}
            className="mt-3 text-sm font-medium text-brand hover:underline"
          >
            Change return flight
          </button>
        </div>
      </div>

      <div className="card flex items-center justify-between p-5">
        <div>
          <div className="text-sm text-slate-500">
            Total round-trip price
          </div>

          <div className="text-2xl font-bold text-slate-900">
            ₹{total.toLocaleString('en-IN')}
          </div>
        </div>

        <button className="btn-primary">
          Continue
        </button>
      </div>
    </div>
  );
}
