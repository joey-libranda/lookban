import type { Metadata } from "next";
import { CheckCircle2, ExternalLink, FileWarning } from "lucide-react";
import Link from "next/link";
import { getAdminApplications, type AdminApplication } from "@/server/queries/applications";
import { getAdminDocumentRequests, type AdminDocRequest, type DocFile } from "@/server/queries/documents";
import { DOC_STATUS_LABEL, DOC_STATUS_TONE, docStatus } from "@/lib/doc-status";
import { ApplicationReview } from "@/components/admin/ApplicationReview";
import { formatDateTime } from "@/lib/utils/labels";

export const metadata: Metadata = { title: "Applications · Admin" };

const today = () => new Date().toISOString().slice(0, 10);

function Detail({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><dt className="text-xs font-bold uppercase text-muted">{k}</dt><dd className="mt-0.5 break-words text-sm">{v || "-"}</dd></div>;
}

function PendingCard({ a }: { a: AdminApplication }) {
  const expired = !a.permit_expiry || a.permit_expiry < today();
  const missing = a.docs.some((d) => d.missing) || !a.permit_number || !a.registration_number;
  return (
    <article className="card p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div><h3 className="text-2xl">{a.store_name}</h3><p className="text-sm text-muted">Applied {formatDateTime(a.created_at)} · account {a.applicant?.email}</p></div>
        <span className="rounded-full bg-yellow px-3 py-0.5 text-xs font-bold text-ink">Pending</span>
      </header>
      <p className="mt-3 text-sm">{a.description}</p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <Detail k="Owner" v={a.owner_name} />
        <Detail k="Contact" v={[a.phone, a.contact_email].filter(Boolean).join(" · ")} />
        <Detail k="Business Address" v={a.address} />
        <Detail k="Permit No." v={a.permit_number} />
        <Detail k="Permit Valid Until" v={<span className={expired ? "font-bold text-red-700" : ""}>{a.permit_expiry ?? "-"}{expired ? " (expired)" : ""}</span>} />
        <Detail k="Registration No. (DTI / SEC / CDA)" v={a.registration_number} />
      </dl>
      <div className="mt-4">
        <p className="text-xs font-bold uppercase text-muted">Proof of Business</p>
        <ul className="mt-1 space-y-1.5">
          {a.docs.map((d) => (
            <li key={d.label} className="flex items-center gap-2 text-sm">
              {d.missing || !d.url ? <FileWarning className="size-4 text-red-700" aria-hidden /> : <CheckCircle2 className="size-4 text-green-700" aria-hidden />}
              {d.url ? <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue hover:text-orange">{d.label} <ExternalLink className="size-3.5" aria-hidden /></a>
                     : <span className="text-red-700">{d.label}: {d.missing ? "not uploaded" : "could not be opened"}</span>}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-muted">Links open the private file and expire after 10 minutes. Refresh the page for new links.</p>
      </div>
      <ApplicationReview id={a.id} storeName={a.store_name} canApprove={!expired && !missing} />
    </article>
  );
}

function FileLinks({ files }: { files: DocFile[] }) {
  if (!files.length) return <p className="text-sm text-muted">None on file.</p>;
  return (
    <ul className="space-y-1.5">
      {files.map((d) => (
        <li key={d.label} className="flex items-center gap-2 text-sm">
          {d.url ? <CheckCircle2 className="size-4 text-green-700" aria-hidden /> : <FileWarning className="size-4 text-red-700" aria-hidden />}
          {d.url ? <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue hover:text-orange">{d.label} <ExternalLink className="size-3.5" aria-hidden /></a>
                 : <span className="text-red-700">{d.label}: could not be opened</span>}
        </li>
      ))}
    </ul>
  );
}

/** One side-by-side row: what is on file vs what the vendor wants. */
function Change({ label, from, to }: { label: string; from: string | null | undefined; to: string | null }) {
  if (!to) return null;
  return (
    <tr className="border-t border-line align-top">
      <th scope="row" className="py-2 pr-3 text-left text-sm font-semibold">{label}</th>
      <td className="py-2 pr-3 text-sm text-muted">{from || "Not on file"}</td>
      <td className="py-2 text-sm font-semibold">{to}</td>
    </tr>
  );
}

function DocRequestCard({ r }: { r: AdminDocRequest }) {
  const cur = r.current;
  const newExpiry = r.permit_expiry ?? cur?.permit_expiry ?? null;
  const stillExpired = docStatus(newExpiry) === "expired" || docStatus(newExpiry) === "missing";
  const incomplete = !(r.permit_number ?? cur?.permit_number) || !(r.registration_number ?? cur?.registration_number) || !(r.permit_path ?? cur?.permit_path) || !(r.registration_path ?? cur?.registration_path);
  const st = docStatus(cur?.permit_expiry);
  return (
    <article className="card p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-2xl">{r.store?.name ?? "Store"}</h3>
          <p className="text-sm text-muted">Sent {formatDateTime(r.created_at)} · record on file: <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${DOC_STATUS_TONE[st]}`}>{DOC_STATUS_LABEL[st]}</span></p>
        </div>
        <span className="rounded-full bg-yellow px-3 py-0.5 text-xs font-bold text-ink">Pending</span>
      </header>
      {r.vendor_note && <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm"><span className="font-semibold">Vendor&apos;s note:</span> {r.vendor_note}</p>}
      <table className="mt-4 w-full">
        <thead><tr><th className="pb-1 text-left text-xs font-bold uppercase text-muted">Detail</th><th className="pb-1 text-left text-xs font-bold uppercase text-muted">On File Now</th><th className="pb-1 text-left text-xs font-bold uppercase text-muted">Requested</th></tr></thead>
        <tbody>
          <Change label="Permit No." from={cur?.permit_number} to={r.permit_number} />
          <Change label="Permit Valid Until" from={cur?.permit_expiry} to={r.permit_expiry} />
          <Change label="Registration No." from={cur?.registration_number} to={r.registration_number} />
        </tbody>
      </table>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><p className="mb-1 text-xs font-bold uppercase text-muted">New Files</p><FileLinks files={r.newFiles} /></div>
        <div><p className="mb-1 text-xs font-bold uppercase text-muted">Files on File Now</p><FileLinks files={r.currentFiles} /></div>
      </div>
      <p className="mt-1 text-xs text-muted">Links open the private file and expire after 10 minutes. Refresh the page for new links.</p>
      <ApplicationReview kind="documents" id={r.id} storeName={r.store?.name ?? "this store"} canApprove={!stillExpired && !incomplete} />
    </article>
  );
}

async function DocumentUpdates() {
  const reqs = await getAdminDocumentRequests();
  const pending = reqs.filter((r) => r.status === "pending");
  const reviewed = reqs.filter((r) => r.status !== "pending");
  return (
    <>
      <section aria-labelledby="dpend-h" className="space-y-4">
        <h2 id="dpend-h" className="text-2xl">Waiting for Review ({pending.length})</h2>
        {pending.length === 0 ? <p className="card p-5 text-muted">No document updates waiting.</p> : pending.map((r) => <DocRequestCard key={r.id} r={r} />)}
      </section>
      <section aria-labelledby="drev-h" className="space-y-3">
        <h2 id="drev-h" className="text-2xl">Reviewed ({reviewed.length})</h2>
        {reviewed.length === 0 ? <p className="text-muted">Nothing reviewed yet.</p> : (
          <ul className="space-y-2">
            {reviewed.map((r) => (
              <li key={r.id} className="card flex flex-wrap items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{r.store?.name}</p>
                  <p className="text-sm text-muted">Sent {formatDateTime(r.created_at)} · reviewed {r.reviewed_at ? formatDateTime(r.reviewed_at) : "-"}</p>
                  {r.admin_note && <p className="mt-1 text-sm">Note: {r.admin_note}</p>}
                </div>
                <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${r.status === "approved" ? "bg-green-100 text-green-900" : "bg-red-100 text-red-800"}`}>{r.status === "approved" ? "Approved" : "Rejected"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const docsTab = tab === "documents";
  const apps = docsTab ? [] : await getAdminApplications();
  const pending = apps.filter((a) => a.status === "pending");
  const reviewed = apps.filter((a) => a.status !== "pending");
  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-4xl">Applications</h1>
        <p className="mt-1 max-w-2xl text-muted">{docsTab ? "Vendors ask for approval before their permit or registration on file changes. Their current documents stay in place until you approve." : "Check the business information and the uploaded permit and registration before you approve. Approving creates the store and a Vendor Dashboard for the applicant. A rejected applicant can apply again."}</p>
      </div>
      <nav aria-label="Applications" className="flex gap-1 border-b border-line">
        {[["", "New Stores"], ["documents", "Document Updates"]].map(([k, l]) => (
          <Link key={k} href={k ? `/admin/applications?tab=${k}` : "/admin/applications"} aria-current={(docsTab ? "documents" : "") === k ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold pop ${(docsTab ? "documents" : "") === k ? "border-orange text-blue" : "border-transparent text-muted hover:text-blue"}`}>{l}</Link>
        ))}
      </nav>
      {docsTab ? <DocumentUpdates /> : <>
      <section aria-labelledby="pend-h" className="space-y-4">
        <h2 id="pend-h" className="text-2xl">Waiting for Review ({pending.length})</h2>
        {pending.length === 0 ? <p className="card p-5 text-muted">No applications waiting.</p> : pending.map((a) => <PendingCard key={a.id} a={a} />)}
      </section>
      <section aria-labelledby="rev-h" className="space-y-3">
        <h2 id="rev-h" className="text-2xl">Reviewed ({reviewed.length})</h2>
        {reviewed.length === 0 ? <p className="text-muted">Nothing reviewed yet.</p> : (
          <ul className="space-y-2">
            {reviewed.map((a) => (
              <li key={a.id} className="card flex flex-wrap items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{a.store_name} <span className="font-normal text-muted">· {a.owner_name ?? a.applicant?.full_name}</span></p>
                  <p className="text-sm text-muted">{a.applicant?.email} · reviewed {a.reviewed_at ? formatDateTime(a.reviewed_at) : "-"}</p>
                  {a.admin_note && <p className="mt-1 text-sm">Note: {a.admin_note}</p>}
                </div>
                <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${a.status === "approved" ? "bg-green-100 text-green-900" : "bg-red-100 text-red-800"}`}>{a.status === "approved" ? "Approved" : "Rejected"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>}
    </div>
  );
}
