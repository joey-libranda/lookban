export default function AdminLoading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-4">
      <div className="h-10 w-56 animate-pulse rounded-lg bg-line" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-line" />)}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-line" />
    </div>
  );
}
