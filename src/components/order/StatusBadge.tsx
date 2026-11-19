import { fulfillmentLabel } from "@/lib/utils/labels";
import type { FulfillmentStatus } from "@/types/db";

const TONE: Record<FulfillmentStatus, string> = {
  pending: "bg-yellow text-dark", confirmed: "bg-blue-50 text-brand", preparing: "bg-blue-50 text-brand",
  out_for_delivery: "bg-blue-50 text-brand", delivered: "bg-green-50 text-green-800", cancelled: "bg-red-50 text-red-800",
};

export function StatusBadge({ status }: { status: FulfillmentStatus }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[status]}`}>{fulfillmentLabel(status)}</span>;
}
