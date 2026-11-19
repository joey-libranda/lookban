import type { Metadata } from "next";
import { AccountShell } from "@/components/account/AccountShell";
import { ProfileSection, Section, SecuritySection, Tile } from "@/components/account/AccountSections";
import { requireVendor } from "@/lib/auth/guards";
import { getVendorDashboard } from "@/server/queries/vendor";

export const metadata: Metadata = { title: "My Account · Vendor" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "profile", label: "Profile" },
  { key: "security", label: "Security" },
];

export default async function VendorAccount({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user, profile, store } = await requireVendor("/vendor/account");
  const { tab } = await searchParams;
  const active = TABS.some((t) => t.key === tab) ? (tab as string) : "overview";
  const d = active === "overview" ? await getVendorDashboard(store.id) : null;
  const storeState = store.status === "approved" ? "Open to customers" : store.status === "pending" ? "Waiting for approval" : "Suspended";

  return (
    <div className="w-full">
      <AccountShell profile={profile} base="/vendor/account" tabs={TABS} active={active} horizontal>
        {active === "overview" && d && (
          <>
            <Section title={store.name} hint={store.address ?? undefined}>
              <p className="text-sm"><span className="font-semibold">Store status:</span> {storeState}</p>
            </Section>
            <div className="grid gap-3 sm:grid-cols-3">
              <Tile label="Orders to Prepare" value={d.toHandle} href="/vendor/orders?status=pending" />
              <Tile label="Products Awaiting Approval" value={d.pendingProducts} href="/vendor/products?status=pending" />
              <Tile label="Products Needing Changes" value={d.rejectedProducts} href="/vendor/products?status=rejected" />
            </div>
          </>
        )}
        {active === "profile" && <ProfileSection profile={profile} />}
        {active === "security" && <SecuritySection profile={profile} lastSignIn={user.last_sign_in_at} />}
      </AccountShell>
    </div>
  );
}
