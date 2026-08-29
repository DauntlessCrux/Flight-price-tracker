'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

export default function PriceChart({ history, targetPrice }) {
  const data = history.map((h) => ({
    date: formatDate(h.checked_at),
    price: h.price,
  }));

  if (!data.length) {
    return <div className="p-6 text-center text-sm text-slate-500">No price history yet.</div>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="#94a3b8"
            tickFormatter={(v) => `₹${v.toLocaleString('en-IN')}`}
            domain={['dataMin - 300', 'dataMax + 300']}
          />
          <Tooltip formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, 'Price']} />
          {targetPrice && (
            <ReferenceLine
              y={targetPrice}
              stroke="#16a34a"
              strokeDasharray="4 4"
              label={{ value: 'Target', fontSize: 11, fill: '#16a34a', position: 'insideTopLeft' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="price"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 4, fill: '#2563eb' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
