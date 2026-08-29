'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import airports from '@/data/airports.json';

function matchAirports(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return airports
    .filter(
      (a) =>
        a.code.toLowerCase().startsWith(q) ||
        a.city.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q)
    )
    .slice(0, 8);
}

export default function AirportAutocomplete({ label, value, onChange, placeholder }) {
  const [query, setQuery] = useState(value?.label || '');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef(null);

  const results = useMemo(() => matchAirports(query), [query]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectAirport(airport) {
    setQuery(`${airport.city} (${airport.code})`);
    onChange({ code: airport.code, label: `${airport.city} (${airport.code})` });
    setOpen(false);
  }

  function handleKeyDown(e) {
    if (!open || !results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectAirport(results[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
      <input
        className="input"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlighted(0);
          // Clear the committed code until the user picks a suggestion again.
          onChange({ code: '', label: e.target.value });
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        required
      />

      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.map((a, i) => (
            <li
              key={a.code}
              onMouseDown={() => selectAirport(a)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === highlighted ? 'bg-brand-light' : 'hover:bg-slate-50'
              }`}
            >
              <div className="font-medium text-slate-800">
                {a.city} <span className="text-slate-400">({a.code})</span>
              </div>
              <div className="text-xs text-slate-400">{a.name}, {a.country}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
