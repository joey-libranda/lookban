"use client";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-4xl">Something went wrong</h1>
      <p className="mt-3 text-muted">We couldn&apos;t load this page. Please try again in a moment.</p>
      {process.env.NODE_ENV !== "production" && <p className="mt-3 break-words rounded-lg bg-red-50 p-3 text-left text-sm text-red-800">{error.message}</p>}
      <button onClick={reset} className="btn-primary mt-6">Try Again</button>
    </div>
  );
}
