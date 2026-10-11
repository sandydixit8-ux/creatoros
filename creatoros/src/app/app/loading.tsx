export default function AppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-56 animate-pulse rounded-lg bg-navy-100" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-navy-100" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-28 animate-pulse bg-navy-100/70" />
        ))}
      </div>
      <div className="card h-64 animate-pulse bg-navy-100/70" />
    </div>
  );
}