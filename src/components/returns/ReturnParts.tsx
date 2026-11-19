import Image from "next/image";
import Link from "next/link";
import { ACTOR_LABEL, EVENT_LABEL, RETURN_REASONS, RETURN_STATUS_LABEL, RETURN_STATUS_TONE, type ReturnStatus } from "@/lib/returns";
import { formatPeso } from "@/lib/utils/format";
import { formatDateTime } from "@/lib/utils/labels";
import type { ReturnDetail, ReturnSummary } from "@/server/queries/returns";

export function ReturnStatusBadge({ status, label }: { status: ReturnStatus; label?: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${RETURN_STATUS_TONE[status]}`}>{label ?? RETURN_STATUS_LABEL[status]}</span>;
}

/** Table used by the customer, vendor and admin lists. `base` is the detail URL prefix. */
export function ReturnsTable({ rows, base, empty, showCustomer = false }: { rows: ReturnSummary[]; base: string; empty: string; showCustomer?: boolean }) {
  if (rows.length === 0) return <p className="card p-5 text-muted">{empty}</p>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b border-line bg-cream text-xs uppercase text-muted">
          <tr>
            <th className="px-4 py-3">Order</th>{showCustomer && <th className="px-4 py-3">Customer</th>}<th className="px-4 py-3">Store</th>
            <th className="px-4 py-3">Problem</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Refund</th><th className="px-4 py-3"><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3"><p className="font-semibold">{r.receipt_no}</p><p className="text-xs text-muted">{formatDateTime(r.created_at)}</p></td>
              {showCustomer && <td className="px-4 py-3">{r.customer_name}</td>}
              <td className="px-4 py-3">{r.store_name}</td>
              <td className="px-4 py-3">{RETURN_REASONS[r.reason]}<p className="text-xs text-muted">Wants a {r.desired}</p></td>
              <td className="px-4 py-3"><ReturnStatusBadge status={r.status} /></td>
              <td className="px-4 py-3 text-right">{r.resolution === "refund" || (r.status !== "rejected" && r.status !== "cancelled" && r.desired === "refund" && r.refund_amount > 0) ? formatPeso(r.refund_amount) : "-"}</td>
              <td className="px-4 py-3 text-right"><Link href={`${base}/${r.id}`} className="font-semibold text-brand pop hover:text-orange">Open</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Everything about one request: problem, items, photos, decision and timeline. Shown to all three roles. */
export function ReturnBody({ r }: { r: ReturnDetail }) {
  return (
    <div className="space-y-5">
      <section className="card p-5" aria-labelledby="rb-problem">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="rb-problem" className="text-2xl">{RETURN_REASONS[r.reason]}</h2>
            <p className="text-sm text-muted">{r.store_name} · Order {r.receipt_no} · sent {formatDateTime(r.created_at)}</p>
          </div>
          <ReturnStatusBadge status={r.status} />
        </div>
        <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-cream p-4 text-sm">{r.details}</p>
        <p className="mt-3 text-sm"><span className="font-semibold">The customer wants:</span> {r.desired === "refund" ? "A refund" : "A replacement"}</p>

        <h3 className="mt-5 text-lg">Items</h3>
        <ul className="divide-y divide-line text-sm">
          {r.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-4 py-2">
              <span>{i.quantity} × {i.product_name}{i.variant_label ? ` (${i.variant_label})` : ""} <span className="text-muted">@ {formatPeso(i.unit_price)}</span></span>
              <span className="shrink-0 font-semibold">{formatPeso(i.line_refund)}</span>
            </li>
          ))}
        </ul>

        {r.photos.length > 0 && (
          <>
            <h3 className="mt-5 text-lg">Photos</h3>
            <ul className="mt-2 flex flex-wrap gap-3">
              {r.photos.map((p, n) => (
                <li key={p.id}>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="relative block size-28 overflow-hidden rounded-lg border border-line">
                      <Image src={p.url} alt={`Photo ${n + 1} of the problem`} fill sizes="112px" className="object-cover" unoptimized />
                    </a>
                  ) : <span className="flex size-28 items-center justify-center rounded-lg border border-line p-2 text-center text-xs text-muted">Photo could not be opened</span>}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-muted">Photos are private. Links expire after 10 minutes; refresh the page for new ones.</p>
          </>
        )}
      </section>

      {(r.status === "approved" || r.status === "completed") && (
        <section className="card p-5 text-sm" aria-labelledby="rb-outcome">
          <h2 id="rb-outcome" className="text-2xl">Outcome</h2>
          {r.resolution === "refund" ? (
            <dl className="mt-3 space-y-1">
              <div className="flex justify-between"><dt>Items</dt><dd>{formatPeso(r.items_refund)}</dd></div>
              <div className="flex justify-between"><dt>Shipping</dt><dd>{formatPeso(r.shipping_refund)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 text-lg font-bold text-brand"><dt>Refund</dt><dd>{formatPeso(r.refund_amount)}</dd></div>
            </dl>
          ) : <p className="mt-2">The store will send a replacement.</p>}
          {r.status === "completed" && r.refund_reference && <p className="mt-3"><span className="font-semibold">Reference:</span> {r.refund_reference}</p>}
          <p className="mt-3 text-xs text-muted">The refund is recorded by the store or LOOKBAN after they send the money. LOOKBAN does not move money automatically.</p>
        </section>
      )}

      {(r.store_note || r.admin_note) && (
        <section className="card space-y-3 p-5 text-sm" aria-label="Replies">
          {r.store_note && <p><span className="font-semibold">{r.store_name}:</span> {r.store_note}</p>}
          {r.admin_note && <p><span className="font-semibold">LOOKBAN:</span> {r.admin_note}</p>}
        </section>
      )}

      <section className="card p-5" aria-labelledby="rb-timeline">
        <h2 id="rb-timeline" className="text-2xl">Timeline</h2>
        <ol className="mt-4">
          {r.events.map((e, n) => (
            <li key={e.id} className={`relative pl-7 text-sm ${n < r.events.length - 1 ? "pb-5" : ""}`}>
              {n < r.events.length - 1 && <span className="absolute bottom-0 left-[4px] top-4 w-0.5 bg-line" aria-hidden />}
              <span className="absolute left-0 top-1.5 size-2.5 rounded-full bg-orange" aria-hidden />
              <p className="font-semibold">{EVENT_LABEL[e.event] ?? e.event} <span className="font-normal text-muted">· {ACTOR_LABEL[e.actor_role]} · {formatDateTime(e.created_at)}</span></p>
              {e.note && <p className="mt-0.5 whitespace-pre-wrap break-words text-muted">{e.note}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
