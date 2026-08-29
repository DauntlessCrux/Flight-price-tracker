'use client';

import { useState } from 'react';

function formatDuration(mins) {
  if (mins == null) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export default function FlightCard({ flight, search, onTracked }) {
  const [saving, setSaving] = useState(false);
  const [tracked, setTracked] = useState(false);
  const [showTarget, setShowTarget] = useState(false);
  const [targetPrice, setTargetPrice] = useState(Math.round(flight.price * 0.9));

  async function handleTrack() {
    setSaving(true);
    try {
      const res = await fetch('/api/tracked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: flight.origin,
          destination: flight.destination,
          departureDate: search.departureDate,
          returnDate: search.returnDate || null,
          targetPrice,
          currentPrice: flight.price,
        }),
      });
      if (!res.ok) throw new Error('Failed to track flight');
      setTracked(true);
      onTracked?.();
    } catch (err) {
      console.error(err);
      alert('Could not track this flight. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const duration = formatDuration(flight.durationMinutes);

  return (
    <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
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

      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-lg font-bold text-slate-900">₹{flight.price.toLocaleString('en-IN')}</div>
        </div>

        {tracked ? (
          <span className="rounded-lg bg-drop/10 px-4 py-2 text-sm font-semibold text-drop">
            ✓ Tracking
          </span>
        ) : showTarget ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              className="input w-28"
              value={targetPrice}
              onChange={(e) => setTargetPrice(Number(e.target.value))}
            />
            <button className="btn-primary" disabled={saving} onClick={handleTrack}>
              {saving ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        ) : (
          <button className="btn-secondary" onClick={() => setShowTarget(true)}>
            Track Price
          </button>
        )}
      </div>
    </div>
  );
}
