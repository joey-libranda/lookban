import type { Metadata } from "next";
import { AccountShell } from "@/components/account/AccountShell";
import { ProfileSection, SecuritySection, Tile } from "@/components/account/AccountSections";
import { requireAdmin } from "@/lib/auth/guards";
import { getAdminOverview } from "@/server/queries/account";
import { getPendingProductCount } from "@/server/queries/admin";
import { getPendingApplicationCount } from "@/server/queries/applications";

export const metadata: Metadata = { title: "My Account · Admin" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "profile", label: "Profile" },
  { key: "security", label: "Security" },
];

export default async function AdminAccount({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user, profile } = await requireAdmin("/admin/account");
  const { tab } = await searchParams;
  const active = TABS.some((t) => t.key === tab) ? (tab as string) : "overview";
  const [apps, prods, o] = active === "overview"
    ? await Promise.all([getPendingApplicationCount(), getPendingProductCount(), getAdminOverview()])
    : [0, 0, { newOrders: 0, unreadMessages: 0 }];

  return (
    <div className="w-full">
      <AccountShell profile={profile} base="/admin/account" tabs={TABS} active={active} horizontal>
        {active === "overview" && (
          <>
            <p className="text-lg">Things waiting for you.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Tile label="Store Applications" value={apps} href="/admin/applications" />
              <Tile label="Products to Approve" value={prods} href="/admin/products?status=pending" />
              <Tile label="New Orders" value={o.newOrders} href="/admin/orders" />
              <Tile label="Unread Messages" value={o.unreadMessages} href="/admin/messages" />
            </div>
          </>
        )}
        {active === "profile" && <ProfileSection profile={profile} />}
        {active === "security" && <SecuritySection profile={profile} lastSignIn={user.last_sign_in_at} />}
      </AccountShell>
    </div>
  );
}
