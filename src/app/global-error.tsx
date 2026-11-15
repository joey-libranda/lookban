"use client";

// Last-resort boundary: renders when the root layout itself fails. Must include <html>/<body>.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "6rem 1rem" }}>
        <h1 style={{ color: "#00167a" }}>LOOKBAN is having a problem</h1>
        <p>Please try again in a moment.</p>
        <button onClick={reset} style={{ background: "#fc4c00", color: "#fff", border: 0, borderRadius: 8, padding: "10px 20px", fontWeight: 600 }}>Try again</button>
      </body>
    </html>
  );
}
