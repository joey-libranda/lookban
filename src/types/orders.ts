import type { FulfillmentStatus, PaymentMethod, PaymentStatus } from "@/types/db";

export interface OrderItemRow {
  id: string; product_id: string | null; product_name: string; variant_label: string;
  price_at_purchase: number; quantity: number; line_total: number;
}
export interface StoreOrderRow {
  id: string; store_id: string | null; store_name: string; store_slug: string | null;
  store_address: string | null; store_phone: string | null;
  subtotal: number; shipping_fee: number; total: number;
  fulfillment_status: FulfillmentStatus; items: OrderItemRow[];
}
export interface OrderRow {
  id: string; receipt_no: string; created_at: string;
  customer_name: string; customer_phone: string; customer_email: string | null;
  delivery_line1: string; delivery_barangay: string | null; delivery_city: string;
  delivery_province: string; delivery_postal: string | null; notes: string | null;
  payment_method: PaymentMethod; payment_status: PaymentStatus; status: FulfillmentStatus;
  subtotal: number; shipping_total: number; total: number;
  store_orders: StoreOrderRow[];
}
