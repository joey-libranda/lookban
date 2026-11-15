import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getDefaultAddress } from "@/server/queries/orders";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { AddressForm, ProfileForm } from "@/components/account/AccountForms";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const { profile } = await requireUser("/account");
  if (profile.role === "admin") redirect("/admin/account");
  const address = await getDefaultAddress();
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-6">
      <div>
        <h1 className="text-4xl">Hello, {profile.full_name?.split(" ")[0] ?? "there"}</h1>
        <p className="mt-1 text-muted">{profile.email}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/account/orders" className="btn-outline">My Orders</Link>
        <LogoutButton />
      </div>
      <section className="card p-5" aria-labelledby="prof">
        <h2 id="prof" className="mb-4 text-2xl">Your details</h2>
        <ProfileForm fullName={profile.full_name ?? ""} phone={profile.phone ?? ""} />
      </section>
      <section className="card p-5" aria-labelledby="addr">
        <h2 id="addr" className="text-2xl">Delivery address</h2>
        <p className="mb-4 mt-1 text-sm text-muted">We fill this in at checkout so you don&apos;t have to retype it. You can still change it for any order.</p>
        <AddressForm address={address} fallbackName={profile.full_name ?? ""} fallbackPhone={profile.phone ?? ""} />
      </section>
    </div>
  );
}
