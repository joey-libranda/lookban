import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/AccountShell";
import { AddressForm } from "@/components/account/AccountForms";
import { ProfileSection, Section, SecuritySection, Tile } from "@/components/account/AccountSections";
import { StatusBadge } from "@/components/order/StatusBadge";
import { requireUser } from "@/lib/auth/guards";
import { formatPeso } from "@/lib/utils/format";
import { formatDateTime } from "@/lib/utils/labels";
import { getCustomerOverview } from "@/server/queries/account";
import { getDefaultAddress, getMyOrders } from "@/server/queries/orders";

export const metadata: Metadata = { title: "My Account" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "profile", label: "Profile" },
  { key: "security", label: "Security" },
  { key: "address", label: "Delivery Address" },
];

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user, profile } = await requireUser("/account");
  if (profile.role === "admin") redirect("/admin/account");
  if (profile.role === "vendor") redirect("/vendor/account");
  const { tab } = await searchParams;
  const active = TABS.some((t) => t.key === tab) ? (tab as string) : "overview";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <AccountShell profile={profile} base="/account" tabs={TABS} active={active} extraLinks={[{ href: "/account/orders", label: "My Orders" }, { href: "/account/returns", label: "My Returns" }]}>
        {active === "overview" && <Overview firstName={profile.full_name?.split(" ")[0] ?? "there"} />}
        {active === "profile" && <ProfileSection profile={profile} />}
        {active === "security" && <SecuritySection profile={profile} lastSignIn={user.last_sign_in_at} />}
        {active === "address" && <AddressSection name={profile.full_name ?? ""} phone={profile.phone ?? ""} />}
      </AccountShell>
    </div>
  );
}

async function Overview({ firstName }: { firstName: string }) {
  const [orders, o] = await Promise.all([getMyOrders(), getCustomerOverview()]);
  const recent = orders.slice(0, 3);
  return (
    <>
      <p className="text-lg">Hello, {firstName}! Here&apos;s what&apos;s happening with your orders.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Total Orders" value={orders.length} href="/account/orders" />
        <Tile label="On the Way" value={o.toReceive} note="Out for delivery" href="/account/orders" />
        <Tile label="Waiting for Your Rating" value={o.toRate} note="Delivered, not yet rated" href="/account/orders" />
      </div>
      <Section title="Recent Orders">
        {recent.length === 0 ? (
          <p className="text-muted">You haven&apos;t placed any orders yet. <Link href="/shop" className="font-semibold text-brand pop hover:text-orange">Start Shopping</Link></p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="font-semibold">{r.receipt_no}</p>
                  <p className="text-sm text-muted">{formatDateTime(r.created_at)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status={r.status} />
                  <span className="font-bold text-brand">{formatPeso(r.total)}</span>
                  <Link href={`/orders/${r.id}`} className="font-semibold text-brand pop hover:text-orange">Details</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

async function AddressSection({ name, phone }: { name: string; phone: string }) {
  const address = await getDefaultAddress();
  return (
    <Section title="Delivery Address" hint="We fill this in at checkout so you don't have to retype it. You can still change it for any order.">
      <AddressForm address={address} fallbackName={name} fallbackPhone={phone} />
    </Section>
  );
}
