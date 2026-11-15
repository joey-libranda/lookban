// Row types mirroring supabase/migrations/0001_schema.sql.
// (Can be replaced by `supabase gen types typescript` once the CLI is linked.)
export type UserRole = "customer" | "vendor" | "admin";
export type StoreStatus = "pending" | "approved" | "suspended";
export type PaymentMethod = "cod" | "simulated_online";
export type PaymentStatus = "pending" | "paid" | "simulated" | "refunded" | "cancelled";
export type FulfillmentStatus =
  | "pending" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
}

export interface Store {
  id: string;
  owner_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  logo_url: string | null;
  cover_url: string | null;
  status: StoreStatus;
}
