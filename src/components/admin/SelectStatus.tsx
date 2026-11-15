"use client";

import { useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import type { FormState } from "@/server/actions/admin";
import type { FulfillmentStatus } from "@/types/db";
import { fulfillmentLabel } from "@/lib/utils/labels";
import { Select } from "@/components/ui/Select";

const ORDER: FulfillmentStatus[] = ["pending", "confirmed", "preparing", "out_for_delivery", "delivered"];

/** Only offers statuses the database will accept: forward steps, or cancel. */
export function StatusSelect({ current, action }: { current: FulfillmentStatus; action: (status: string) => Promise<FormState> }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const idx = ORDER.indexOf(current);
  const terminal = current === "delivered" || current === "cancelled";
  const options: FulfillmentStatus[] = terminal ? [] : [...ORDER.slice(idx + 1), "cancelled"];
  if (terminal) return <p className="text-sm text-muted">No further changes (final status).</p>;
  return (
    <div className="w-52">
      <Select aria-label="Update status" value="" disabled={pending}
        onChange={(v) => {
          if (!v) return;
          if (v === "cancelled" && !window.confirm("Cancel this part of the order? Stock will be returned.")) return;
          start(async () => {
            try {
              const r = await action(v);
              if (r?.ok) toast("success", "Status updated"); else toast("error", r?.error ?? "Could not update the status.");
            } catch { toast("error", "Couldn't reach the server. Try again."); }
          });
        }}>
        <option value="">{pending ? "Updating…" : "Update status…"}</option>
        {options.map((o) => <option key={o} value={o}>{fulfillmentLabel(o)}</option>)}
      </Select>
    </div>
  );
}
