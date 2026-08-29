import SearchForm from '@/components/SearchForm';

const POPULAR_ROUTES = [
  { from: 'GAU', to: 'DEL', label: 'Guwahati → Delhi' },
  { from: 'BOM', to: 'BLR', label: 'Mumbai → Bangalore' },
  { from: 'DEL', to: 'BOM', label: 'Delhi → Mumbai' },
  { from: 'CCU', to: 'DEL', label: 'Kolkata → Delhi' },
];

export default function HomePage() {
  return (
    <div>
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-10 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Track flights. <span className="text-brand">Save money.</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-500">
          Search a route, set a target price, and we'll watch it for you — email you the moment it drops.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <SearchForm />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Popular routes
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {POPULAR_ROUTES.map((r) => (
            <a
              key={r.label}
              href={`/search?origin=${r.from}&destination=${r.to}`}
              className="card p-4 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand"
            >
              {r.label}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
