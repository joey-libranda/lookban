"use client";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card p-6">
      <h1 className="text-3xl">This admin page couldn&apos;t load</h1>
      <p className="mt-2 text-muted">Check your connection and try again. If it keeps happening, the database may be unreachable or a migration may be missing.</p>
      {process.env.NODE_ENV !== "production" && <p className="mt-3 break-words rounded-lg bg-red-50 p-3 text-sm text-red-800">{error.message}</p>}
      {error.digest && <p className="mt-2 text-xs text-muted">Reference: {error.digest}</p>}
      <button onClick={reset} className="btn-primary mt-4">Try Again</button>
    </div>
  );
}
