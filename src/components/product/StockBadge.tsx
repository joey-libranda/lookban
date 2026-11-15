import { availability } from "@/lib/utils/format";

const TONES = {
  ok: "bg-green-50 text-green-800",
  low: "bg-yellow text-ink",
  out: "bg-red-50 text-red-800",
  closed: "bg-line text-muted",
} as const;

/** Only speaks up when something is wrong or running low; "In stock" is shown only when `showInStock` is set. */
export function StockBadge({ stock, storeOpen = true, showInStock = false }: { stock: number; storeOpen?: boolean; showInStock?: boolean }) {
  const a = availability(stock, storeOpen);
  if (a.tone === "ok" && !showInStock) return null;
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[a.tone]}`}>{a.label}</span>;
}
