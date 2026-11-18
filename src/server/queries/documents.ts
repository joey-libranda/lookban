import "server-only";
import { createClient } from "@/lib/supabase/server";

export type StoreDocuments = {
  store_id: string; permit_number: string | null; permit_expiry: string | null; registration_number: string | null;
  permit_path: string | null; registration_path: string | null; sanitary_path: string | null; verified_at: string | null;
};
export type DocFile = { label: string; url: string | null; present: boolean };
export type DocRequest = {
  id: string; store_id: string; status: "pending" | "approved" | "rejected"; created_at: string; reviewed_at: string | null;
  permit_number: string | null; permit_expiry: string | null; registration_number: string | null;
  permit_path: string | null; registration_path: string | null; sanitary_path: string | null;
  vendor_note: string | null; admin_note: string | null;
};

const DOC_COLS = "store_id, permit_number, permit_expiry, registration_number, permit_path, registration_path, sanitary_path, verified_at";
const REQ_COLS = "id, store_id, status, created_at, reviewed_at, permit_number, permit_expiry, registration_number, permit_path, registration_path, sanitary_path, vendor_note, admin_note";

async function signer() {
  const supabase = await createClient();
  return async (path: string | null) => {
    if (!path) return null;
    const { data } = await supabase.storage.from("vendor-documents").createSignedUrl(path, 600); // 10 minutes
    return data?.signedUrl ?? null;
  };
}

export async function filesOf(d: { permit_path: string | null; registration_path: string | null; sanitary_path: string | null }, includeSanitary = true): Promise<DocFile[]> {
  const sign = await signer();
  const [a, b, c] = await Promise.all([sign(d.permit_path), sign(d.registration_path), sign(d.sanitary_path)]);
  return [
    { label: "Business / Mayor's Permit", url: a, present: !!d.permit_path },
    { label: "DTI / SEC / CDA Registration", url: b, present: !!d.registration_path },
    ...(includeSanitary && d.sanitary_path ? [{ label: "Sanitary Permit / FDA", url: c, present: true }] : []),
  ];
}

/** The verified record of one store (RLS: owner or admin only). */
export async function getStoreDocuments(storeId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("store_documents").select(DOC_COLS).eq("store_id", storeId).maybeSingle();
  return (data as StoreDocuments | null) ?? null;
}

export async function getStoreDocumentRequests(storeId: string, limit = 5) {
  const supabase = await createClient();
  const { data } = await supabase.from("store_document_requests").select(REQ_COLS).eq("store_id", storeId).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as DocRequest[];
}

export type AdminDocRequest = DocRequest & {
  store: { name: string; slug: string } | null;
  current: StoreDocuments | null;
  newFiles: DocFile[]; currentFiles: DocFile[];
};

/** Admin: every request (pending first) with the record on file next to it and short-lived file links. */
export async function getAdminDocumentRequests(): Promise<AdminDocRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("store_document_requests")
    .select(`${REQ_COLS}, store:stores!store_id(name, slug)`).order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(`Could not load document updates: ${error.message}`);
  const rows = (data ?? []) as unknown as (DocRequest & { store: AdminDocRequest["store"] | AdminDocRequest["store"][] })[];
  const ids = [...new Set(rows.filter((r) => r.status === "pending").map((r) => r.store_id))];
  const cur = ids.length ? ((await supabase.from("store_documents").select(DOC_COLS).in("store_id", ids)).data ?? []) as StoreDocuments[] : [];
  const out: AdminDocRequest[] = [];
  for (const r of rows) {
    const pending = r.status === "pending";
    const current = cur.find((c) => c.store_id === r.store_id) ?? null;
    out.push({
      ...r, store: Array.isArray(r.store) ? (r.store[0] ?? null) : r.store, current,
      newFiles: pending ? (await filesOf(r)).filter((f) => f.present) : [],
      currentFiles: pending && current ? await filesOf(current) : [],
    });
  }
  return out.sort((x, y) => Number(y.status === "pending") - Number(x.status === "pending"));
}

export async function getPendingDocumentRequestCount() {
  const supabase = await createClient();
  const { count } = await supabase.from("store_document_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
  return count ?? 0;
}
