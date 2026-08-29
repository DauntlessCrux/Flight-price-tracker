'use client';

import { useState } from 'react';
import Link from 'next/link';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TrackedFlightCard({ flight, onRemoved, onChecked }) {
  const [checking, setChecking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const priceChangePct = flight.lowest_price
    ? Math.round(((flight.current_price - flight.lowest_price) / flight.current_price) * 100)
    : 0;

  const belowTarget = flight.current_price <= flight.target_price;

  async function handleCheckNow() {
    setChecking(true);
    setLastResult(null);
    try {
      const res = await fetch(`/api/prices/${flight.id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to check price');
      setLastResult(data);
      onChecked?.();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Could not check price right now.');
    } finally {
      setChecking(false);
    }
  }

  async function handleRemove() {
    if (!confirm('Stop tracking this flight?')) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/tracked/${flight.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove');
      onRemoved?.(flight.id);
    } catch (err) {
      console.error(err);
      alert('Could not remove this flight.');
      setRemoving(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-base font-semibold text-slate-900">
            {flight.origin} → {flight.destination}
          </div>
          <div className="text-xs text-slate-500">
            Departs {formatDate(flight.departure_date)}
            {flight.return_date ? ` · Returns ${formatDate(flight.return_date)}` : ''}
          </div>
        </div>

        {belowTarget && (
          <span className="rounded-full bg-drop/10 px-3 py-1 text-xs font-semibold text-drop">
            Below target 🎉
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-slate-500">Current Price</div>
          <div className="text-lg font-bold text-slate-900">₹{flight.current_price.toLocaleString('en-IN')}</div>
        </div>
        <div>
          <div className="text-slate-500">Target Price</div>
          <div className="text-lg font-bold text-slate-900">₹{flight.target_price.toLocaleString('en-IN')}</div>
        </div>
        <div>
          <div className="text-slate-500">Lowest Price</div>
          <div className="text-lg font-bold text-slate-900">₹{flight.lowest_price.toLocaleString('en-IN')}</div>
        </div>
      </div>

      {priceChangePct !== 0 && (
        <div className={`mt-2 text-xs font-medium ${priceChangePct > 0 ? 'text-drop' : 'text-rise'}`}>
          {priceChangePct > 0 ? '↓' : '↑'} {Math.abs(priceChangePct)}% from current
        </div>
      )}

      {lastResult && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          New price: ₹{lastResult.newPrice.toLocaleString('en-IN')}{' '}
          {lastResult.priceDropped ? '— price dropped, email sent 📧' : '— no drop below target yet'}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/history/${flight.id}`} className="btn-secondary">
          View History
        </Link>
        <button className="btn-secondary" disabled={checking} onClick={handleCheckNow}>
          {checking ? 'Checking…' : 'Check Price Now'}
        </button>
        <button
          className="btn-secondary text-rise hover:bg-rise/10"
          disabled={removing}
          onClick={handleRemove}
        >
          {removing ? 'Removing…' : 'Remove'}
        </button>
      </div>
    </div>
  );
}
