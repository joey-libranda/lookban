import Link from "next/link";

/** Server-rendered pagination that preserves the other query params. */
export function Pagination({ page, pageCount, params }: { page: number; pageCount: number; params: Record<string, string | undefined> }) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `?${qs}` : "?";
  };
  const link = "rounded-lg border border-line px-3.5 py-2 text-sm font-semibold hover:bg-blue-50";
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
      {page > 1 && <Link href={href(page - 1)} className={link}>Previous</Link>}
      <span className="px-2 text-sm text-muted">Page {page} of {pageCount}</span>
      {page < pageCount && <Link href={href(page + 1)} className={link}>Next</Link>}
    </nav>
  );
}
