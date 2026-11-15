export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-busy="true" aria-label="Loading products">
      <div className="h-10 w-72 animate-pulse rounded bg-line" />
      <div className="mt-6 h-28 animate-pulse rounded-xl bg-line/70" />
      <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <li key={i} className="h-80 animate-pulse rounded-xl bg-line/60" />)}
      </ul>
    </div>
  );
}
