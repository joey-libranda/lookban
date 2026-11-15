import type { FulfillmentStatus, PaymentMethod, PaymentStatus } from "@/types/db";

export const paymentMethodLabel = (m: PaymentMethod) =>
  m === "cod" ? "Cash on Delivery" : "Online payment";

/** Simulated payments are never described as paid. */
export const paymentStatusLabel = (s: PaymentStatus, m: PaymentMethod) => {
  if (s === "pending" && m === "cod") return "Unpaid";
  return { pending: "Pending", paid: "Paid", refunded: "Refunded", cancelled: "Cancelled", simulated: "Pending" }[s];
};

export const fulfillmentLabel = (s: FulfillmentStatus) =>
  ({ pending: "Pending", confirmed: "Confirmed", preparing: "Preparing", out_for_delivery: "Out for delivery",
     delivered: "Delivered", cancelled: "Cancelled" })[s];

const dt = new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Manila" });
export const formatDateTime = (iso: string) => dt.format(new Date(iso));
