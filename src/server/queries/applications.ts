import "server-only";
import { createClient } from "@/lib/supabase/server";

export type StoreApplication = {
  id: string; status: "pending" | "approved" | "rejected"; created_at: string; reviewed_at: string | null; admin_note: string | null;
  store_name: string; description: string | null; address: string | null; phone: string | null;
  owner_name: string | null; contact_email: string | null;
  permit_number: string | null; permit_expiry: string | null; registration_number: string | null;
  permit_path: string | null; registration_path: string | null; sanitary_path: string | null;
};

const COLS = "id, status, created_at, reviewed_at, admin_note, store_name, description, address, phone, owner_name, contact_email, permit_number, permit_expiry, registration_number, permit_path, registration_path, sanitary_path";

/** The signed-in applicant's most recent application (RLS only returns their own). */
export async function getMyLatestApplication() {
  const supabase = await createClient();
  const { data } = await supabase.from("vendor_applications").select(COLS).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as StoreApplication | null) ?? null;
}

export type AdminApplication = StoreApplication & {
  applicant: { full_name: string | null; email: string } | null;
  docs: { label: string; url: string | null; missing: boolean }[];
};

/** All applications for the admin (pending first), with short-lived links to the private proof files. */
export async function getAdminApplications(): Promise<AdminApplication[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("vendor_applications")
    .select(`${COLS}, applicant:profiles!applicant_id(full_name, email)`)
    .order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(`Could not load applications: ${error.message}`);
  const rows = (data ?? []) as unknown as (StoreApplication & { applicant: AdminApplication["applicant"] | AdminApplication["applicant"][] })[];

  const sign = async (path: string | null) => {
    if (!path) return null;
    const { data: s } = await supabase.storage.from("vendor-documents").createSignedUrl(path, 600); // 10 minutes
    return s?.signedUrl ?? null;
  };
  const out: AdminApplication[] = [];
  for (const r of rows) {
    const pending = r.status === "pending";
    const [a, b, c] = pending ? await Promise.all([sign(r.permit_path), sign(r.registration_path), sign(r.sanitary_path)]) : [null, null, null];
    out.push({
      ...r,
      applicant: Array.isArray(r.applicant) ? (r.applicant[0] ?? null) : r.applicant,
      docs: [
        { label: "Business / Mayor's Permit", url: a, missing: !r.permit_path },
        { label: "DTI / SEC / CDA Registration", url: b, missing: !r.registration_path },
        ...(r.sanitary_path ? [{ label: "Sanitary Permit / FDA", url: c, missing: false }] : []),
      ],
    });
  }
  return out.sort((x, y) => Number(y.status === "pending") - Number(x.status === "pending"));
}

export async function getPendingApplicationCount() {
  const supabase = await createClient();
  const { count } = await supabase.from("vendor_applications").select("id", { count: "exact", head: true }).eq("status", "pending");
  return count ?? 0;
}
