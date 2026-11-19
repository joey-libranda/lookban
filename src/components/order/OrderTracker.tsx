import { Check, X } from "lucide-react";
import { fulfillmentLabel } from "@/lib/utils/labels";
import type { FulfillmentStatus } from "@/types/db";

const STEPS: { status: FulfillmentStatus; label: string }[] = [
  { status: "pending", label: "Order placed" },
  { status: "confirmed", label: "Confirmed" },
  { status: "preparing", label: "Preparing" },
  { status: "out_for_delivery", label: "Out for delivery" },
  { status: "delivered", label: "Delivered" },
];

/** Progress of an order (or of one store's part of it). Statuses are set by the admin. */
export function OrderTracker({ status, compact }: { status: FulfillmentStatus; compact?: boolean }) {
  if (status === "cancelled") {
    return (
      <p role="status" className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
        <X className="size-4" aria-hidden /> {fulfillmentLabel("cancelled")}
      </p>
    );
  }
  const current = STEPS.findIndex((s) => s.status === status);
  return (
    <ol aria-label="Order progress" className={`grid grid-cols-5 gap-1 ${compact ? "text-[11px]" : "text-xs sm:text-sm"}`}>
      {STEPS.map((s, i) => {
        const done = i < current, now = i === current;
        return (
          <li key={s.status} aria-current={now ? "step" : undefined} className="relative flex flex-col items-center text-center">
            {i < STEPS.length - 1 && (
              <span aria-hidden className={`absolute left-1/2 top-3.5 h-0.5 w-[calc(100%+0.25rem)] -translate-y-1/2 ${i < current ? "bg-success" : "bg-line"}`} />
            )}
            <span className={`relative z-10 flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold
              ${done || (now && status === "delivered") ? "border-success bg-success text-white" : now ? "border-orange bg-orange text-white" : "border-line bg-surface text-muted"}`}>
              {done || (now && status === "delivered") ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <span className={`mt-1.5 leading-tight ${now ? "font-bold text-ink" : done ? "text-ink" : "text-muted"}`}>
              {s.label}<span className="sr-only">{done ? " (done)" : now ? " (current step)" : " (upcoming)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
