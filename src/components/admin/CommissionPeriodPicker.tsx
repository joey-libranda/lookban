"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { QUICK_VIEWS, type Period } from "@/lib/commission-periods";

/** Quick period buttons plus a custom date range. */
export function CommissionPeriodPicker({ period }: { period: Period }) {
  const router = useRouter();
  const [from, setFrom] = useState(period.view === "range" ? period.fromDate : "");
  const [to, setTo] = useState(period.view === "range" ? period.toDate : "");
  const can = !!from && !!to;
  const pill = (on: boolean) => `whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold ${on ? "border-blue bg-blue text-white" : "border-line bg-surface text-ink hover:bg-blue-50"}`;

  return (
    <section aria-label="Report Period" className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 xl:flex-nowrap">
        <div className="flex flex-wrap gap-2 xl:flex-nowrap">
          {QUICK_VIEWS.map((v) => (
            <Link key={v.value} href={`/admin/commission?view=${v.value}`} aria-current={period.view === v.value ? "true" : undefined} className={pill(period.view === v.value)}>{v.label}</Link>
          ))}
        </div>
        <form className="flex flex-wrap items-center gap-2 xl:flex-nowrap" onSubmit={(e) => { e.preventDefault(); if (can) router.push(`/admin/commission?view=range&from=${from}&to=${to}`); }}>
          <label className="sr-only" htmlFor="c-from">From date</label>
          <input id="c-from" type="date" className="input !w-auto !py-1.5 !text-sm" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-sm text-muted">to</span>
          <label className="sr-only" htmlFor="c-to">To date</label>
          <input id="c-to" type="date" className="input !w-auto !py-1.5 !text-sm" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          <button type="submit" disabled={!can} className={`${pill(period.view === "range")} disabled:opacity-50`}>Apply Range</button>
        </form>
      </div>
      <p className="text-sm font-semibold text-muted">Showing: {period.label}</p>
    </section>
  );
}
