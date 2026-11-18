import type { Metadata } from "next";
import { CheckCircle2, ExternalLink, FileWarning } from "lucide-react";
import { getAdminApplications, type AdminApplication } from "@/server/queries/applications";
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

export default async function ApplicationsPage() {
  const apps = await getAdminApplications();
  const pending = apps.filter((a) => a.status === "pending");
  const reviewed = apps.filter((a) => a.status !== "pending");
  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-4xl">Store Applications</h1>
        <p className="mt-1 max-w-2xl text-muted">Check the business information and the uploaded permit and registration before you approve. Approving creates the store and a Vendor Dashboard for the applicant. A rejected applicant can apply again.</p>
      </div>
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
    </div>
  );
}
