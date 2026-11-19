import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, FileWarning } from "lucide-react";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { DocumentUpdateForm } from "@/components/vendor/DocumentUpdateForm";
import { daysUntil, DOC_STATUS_LABEL, DOC_STATUS_TONE, docStatus } from "@/lib/doc-status";
import { formatDateTime } from "@/lib/utils/labels";
import { filesOf, getStoreDocumentRequests, getStoreDocuments } from "@/server/queries/documents";
import { withdrawDocumentRequestAction } from "@/server/actions/documents";

const fmt = (d: string | null) => (d ? new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" }).format(new Date(d)) : "-");

export function ExpiryNotice({ expiry }: { expiry: string | null | undefined }) {
  const s = docStatus(expiry);
  if (s === "valid") return null;
  const msg = s === "missing" ? "Your business documents are not on file yet."
    : s === "expired" ? `Your Business / Mayor's Permit expired on ${fmt(expiry!)}.`
    : `Your Business / Mayor's Permit expires in ${daysUntil(expiry!)} day${daysUntil(expiry!) === 1 ? "" : "s"} (${fmt(expiry!)}).`;
  return (
    <p role="alert" className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${s === "expiring" ? "bg-sun/50" : "bg-red-50 text-red-900"}`}>
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span><span className="font-semibold">{msg}</span> {s === "missing" ? "Send them for approval." : "Upload the renewed permit so LOOKBAN can approve it."}{" "}<Link href="/vendor/store#bd-h" className="font-semibold text-brand pop hover:text-orange">Open Business Documents</Link></span>
    </p>
  );
}

/** Vendor view: the verified record, its expiry status, any pending update, and the form to ask for a change. */
export async function BusinessDocuments({ storeId, userId }: { storeId: string; userId: string }) {
  const [doc, requests] = await Promise.all([getStoreDocuments(storeId), getStoreDocumentRequests(storeId, 3)]);
  const status = docStatus(doc?.permit_expiry);
  const files = doc ? await filesOf(doc) : [];
  const pending = requests.find((r) => r.status === "pending");
  const lastRejected = !pending && requests[0]?.status === "rejected" ? requests[0] : null;

  return (
    <section className="card space-y-5 p-5" aria-labelledby="bd-h">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="bd-h" className="text-2xl">Business Documents</h2>
          <p className="text-sm text-muted">Kept private. Only you and LOOKBAN administrators can open them. Changes need LOOKBAN&apos;s approval.</p>
        </div>
        <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${DOC_STATUS_TONE[status]}`}>{DOC_STATUS_LABEL[status]}</span>
      </div>

      <ExpiryNotice expiry={doc?.permit_expiry} />

      {doc ? (
        <dl className="grid gap-4 sm:grid-cols-3">
          <div><dt className="text-xs font-bold uppercase text-muted">Permit No.</dt><dd className="mt-0.5 break-words text-sm">{doc.permit_number}</dd></div>
          <div><dt className="text-xs font-bold uppercase text-muted">Permit Valid Until</dt><dd className="mt-0.5 text-sm">{fmt(doc.permit_expiry)}</dd></div>
          <div><dt className="text-xs font-bold uppercase text-muted">Registration No.</dt><dd className="mt-0.5 break-words text-sm">{doc.registration_number}</dd></div>
        </dl>
      ) : null}
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li key={f.label} className="flex items-center gap-2 text-sm">
              {f.url ? <CheckCircle2 className="size-4 text-green-700" aria-hidden /> : <FileWarning className="size-4 text-red-700" aria-hidden />}
              {f.url ? <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand hover:text-orange">{f.label} <ExternalLink className="size-3.5" aria-hidden /></a>
                     : <span className="text-red-700">{f.label}: could not be opened</span>}
            </li>
          ))}
          <li className="text-xs text-muted">Links open the private file and expire after 10 minutes.{doc?.verified_at ? ` Verified ${formatDateTime(doc.verified_at)}.` : ""}</li>
        </ul>
      )}

      {lastRejected && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-900">
          <span className="font-semibold">Your last update was sent back.</span> {lastRejected.admin_note} You can send a corrected one below.
        </p>
      )}

      {pending ? (
        <div className="space-y-3 rounded-lg bg-blue-50 p-4 text-sm">
          <p><span className="font-semibold">Update waiting for approval</span>, sent {formatDateTime(pending.created_at)}. Your current documents stay on file until it is approved.</p>
          <ul className="list-disc pl-5">
            {pending.permit_number && <li>New permit number: {pending.permit_number}</li>}
            {pending.permit_expiry && <li>New permit expiry: {fmt(pending.permit_expiry)}</li>}
            {pending.registration_number && <li>New registration number: {pending.registration_number}</li>}
            {pending.permit_path && <li>New Business / Mayor&apos;s Permit file</li>}
            {pending.registration_path && <li>New DTI / SEC / CDA registration file</li>}
            {pending.sanitary_path && <li>New Sanitary Permit / FDA file</li>}
          </ul>
          <ConfirmButton className="font-semibold text-red-700 pop hover:text-red-900" confirm="Withdraw this update?" action={withdrawDocumentRequestAction.bind(null, pending.id)}>Withdraw Update</ConfirmButton>
        </div>
      ) : (
        <details className="group rounded-lg border border-line p-4" open={status === "expired" || status === "missing" || !!lastRejected}>
          <summary className="cursor-pointer font-semibold text-brand pop hover:text-orange">{doc ? "Update My Documents" : "Add My Documents"}</summary>
          <div className="mt-4"><DocumentUpdateForm userId={userId} hasRecord={!!doc} /></div>
        </details>
      )}
    </section>
  );
}
