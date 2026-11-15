/**
 * Row of diamonds echoing Pahiyas kiping leaves. Purely decorative.
 * `straddle` centres it exactly on the edge between this section and the next (half above, half below).
 */
export function PahiyasStrip({ className = "", color = "#000", straddle = false }: { className?: string; color?: string; straddle?: boolean }) {
  const svg =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='14' viewBox='0 0 48 14'><path d='M0 7 L8 0 L16 7 L8 14Z M16 7 L24 0 L32 7 L24 14Z M32 7 L40 0 L48 7 L40 14Z' fill='${color}'/></svg>`,
    );
  return (
    <div aria-hidden className={`h-3.5 w-full ${straddle ? "pointer-events-none absolute inset-x-0 bottom-0 z-20 translate-y-1/2" : ""} ${className}`}
         style={{ backgroundImage: `url("${svg}")`, backgroundRepeat: "repeat-x" }} />
  );
}
