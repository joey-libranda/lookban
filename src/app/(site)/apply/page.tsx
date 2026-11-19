import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, FileCheck2, Store, XCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/guards";
import { getMyLatestApplication } from "@/server/queries/applications";
import { ApplicationForm } from "@/components/apply/ApplicationForm";
import { formatDateTime } from "@/lib/utils/labels";

export const metadata: Metadata = { title: "Store Registration", description: "Apply to sell your Lucban pasalubong on LOOKBAN." };

const STEPS = [
  ["Create an account", "Sign up as a customer, or log in if you already have an account."],
  ["Submit your application", "Tell us about your store and upload your business permit and registration."],
  ["We review it", "A LOOKBAN administrator checks your documents."],
  ["Start selling", "Once approved, you get your own Vendor Dashboard to add products and manage orders."],
];

export default async function ApplyPage() {
  const current = await getCurrentUser();
  const app = current && current.profile.role === "customer" ? await getMyLatestApplication() : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-orange"><Store className="size-4" aria-hidden /> Sell on LOOKBAN</p>
      <h1 className="mt-1 text-4xl">Store Registration</h1>
      <p className="mt-3 max-w-xl text-muted">Own a pasalubong business in Lucban? Put your store in front of customers who are looking for local finds. Every store is verified before it goes live.</p>

      {!current && (
        <>
          <ol className="mt-8 space-y-3">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="card flex gap-4 p-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue font-bold text-white">{i + 1}</span>
                <div><p className="font-semibold">{t}</p><p className="text-sm text-muted">{d}</p></div>
              </li>
            ))}
          </ol>
          <div className="card mt-8 p-5">
            <h2 className="text-2xl">Get Started</h2>
            <p className="mt-1 text-sm text-muted">You need a LOOKBAN account first. After you sign up, come back to this page from the footer link &ldquo;Store Registration&rdquo;.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/login?next=/apply" className="btn-primary">Log In to Apply</Link>
              <Link href="/register" className="btn-outline">Create an Account</Link>
            </div>
          </div>
          <div className="card mt-6 p-5">
            <h2 className="flex items-center gap-2 text-xl"><FileCheck2 className="size-5 text-brand" aria-hidden /> What You&apos;ll Need</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
              <li>Business / Mayor&apos;s Permit (number, valid-until date and a PDF or photo)</li>
              <li>DTI, SEC or CDA registration (number and a PDF or photo)</li>
              <li>Sanitary Permit or FDA license for food products (recommended)</li>
              <li>Owner&apos;s full name, business address, contact number and email</li>
            </ul>
          </div>
        </>
      )}

      {current && current.profile.role === "vendor" && (
        <div className="card mt-8 p-5"><p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-5 text-green-700" aria-hidden /> Your store is on LOOKBAN.</p>
          <Link href="/vendor" className="btn-primary mt-4">Open Vendor Dashboard</Link></div>
      )}
      {current && current.profile.role === "admin" && (
        <p className="card mt-8 p-5 text-muted">Administrator accounts can&apos;t open a store. Review applications in <Link href="/admin/applications" className="font-semibold text-brand">Admin → Applications</Link>.</p>
      )}

      {current?.profile.role === "customer" && app?.status === "pending" && (
        <div className="card mt-8 space-y-3 p-5" role="status">
          <p className="flex items-center gap-2 text-xl font-bold"><Clock className="size-5 text-orange" aria-hidden /> Application under review</p>
          <p className="text-sm text-muted">Thanks, {app.owner_name ?? "there"}! You submitted <span className="font-semibold text-ink">{app.store_name}</span> on {formatDateTime(app.created_at)}. We&apos;re checking your documents. Come back to this page to see the result.</p>
        </div>
      )}

      {current?.profile.role === "customer" && app?.status !== "pending" && (
        <>
          {app?.status === "rejected" && (
            <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5" role="status">
              <p className="flex items-center gap-2 text-lg font-bold text-red-800"><XCircle className="size-5" aria-hidden /> Your last application wasn&apos;t approved</p>
              {app.admin_note && <p className="mt-2 text-sm text-red-900"><span className="font-semibold">Reason:</span> {app.admin_note}</p>}
              <p className="mt-2 text-sm text-red-900">You can fix this and apply again below.</p>
            </div>
          )}
          <div className="card mt-8 p-5 sm:p-7">
            <h2 className="sr-only">Application form</h2>
            <ApplicationForm userId={current.user.id}
              defaults={app ? { store_name: app.store_name, description: app.description ?? "", address: app.address ?? "", owner_name: app.owner_name ?? "", contact_email: app.contact_email ?? "", phone: app.phone ?? "", permit_number: app.permit_number ?? "", registration_number: app.registration_number ?? "" } : { owner_name: current.profile.full_name ?? "", contact_email: current.profile.email ?? "", phone: current.profile.phone ?? "" }} />
          </div>
        </>
      )}
    </div>
  );
}
