import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Avatar } from "@/components/account/Avatar";
import type { Profile } from "@/types/db";

export type AccountTab = { key: string; label: string };
const ROLE: Record<Profile["role"], { label: string; tone: string }> = {
  customer: { label: "Customer", tone: "bg-yellow text-ink" },
  vendor: { label: "Vendor", tone: "bg-blue-50 text-blue" },
  admin: { label: "Administrator", tone: "bg-blue text-white" },
};

const memberSince = (iso: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "Asia/Manila" }).format(new Date(iso));

/**
 * Shared My Account frame for customers, vendors and admins: a header with the photo, name and role,
 * then a side menu (wraps into tabs on small screens). Tabs are plain links (?tab=...), so every view is server-rendered.
 */
export function AccountShell({ profile, base, tabs, active, extraLinks = [], horizontal = false, children }: {
  profile: Profile; base: string; tabs: AccountTab[]; active: string; /** Tabs in a row under the header (admin and vendor already have a sidebar). */ horizontal?: boolean;
  extraLinks?: { href: string; label: string }[]; children: React.ReactNode;
}) {
  const role = ROLE[profile.role];
  const item = "block rounded-lg px-3 py-2 text-sm font-semibold pop";
  return (
    <div className="space-y-6">
      <header className="card flex flex-wrap items-center gap-4 p-5">
        <Avatar path={profile.avatar_path} name={profile.full_name} email={profile.email} size={72} />
        <div className="min-w-0">
          <h1 className="truncate text-3xl sm:text-4xl">{profile.full_name || "My Account"}</h1>
          <p className="truncate text-sm text-muted">{profile.email}</p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className={`rounded-full px-2.5 py-0.5 font-semibold ${role.tone}`}>{role.label}</span>
            <span>Member since {memberSince(profile.created_at)}</span>
          </p>
        </div>
      </header>
      {horizontal ? (
        <>
          <nav aria-label="My Account" className="flex flex-wrap gap-1 border-b border-line">
            {tabs.map((t) => (
              <Link key={t.key} href={t.key === tabs[0].key ? base : `${base}?tab=${t.key}`} aria-current={active === t.key ? "page" : undefined}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold pop ${active === t.key ? "border-orange text-blue" : "border-transparent text-muted hover:text-blue"}`}>{t.label}</Link>
            ))}
          </nav>
          <div className="min-w-0 space-y-6">{children}</div>
        </>
      ) : (
      <div className="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="My Account" className="flex flex-wrap gap-1 md:flex-col">
          {tabs.map((t) => (
            <Link key={t.key} href={t.key === tabs[0].key ? base : `${base}?tab=${t.key}`} aria-current={active === t.key ? "page" : undefined}
              className={`${item} ${active === t.key ? "bg-blue text-white" : "text-blue hover:bg-blue-50"}`}>{t.label}</Link>
          ))}
          {extraLinks.length > 0 && <span className="hidden md:my-2 md:block md:border-t md:border-line" aria-hidden />}
          {extraLinks.map((l) => (
            <Link key={l.href} href={l.href} className={`${item} flex items-center justify-between gap-2 text-blue hover:bg-blue-50`}>
              {l.label} <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          ))}
        </nav>
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
      )}
    </div>
  );
}
