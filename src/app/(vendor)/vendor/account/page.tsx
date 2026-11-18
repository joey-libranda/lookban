import type { Metadata } from "next";
import { requireVendor } from "@/lib/auth/guards";
import { ProfileForm } from "@/components/account/AccountForms";

export const metadata: Metadata = { title: "My account · Vendor" };

export default async function VendorAccount() {
  const { profile } = await requireVendor("/vendor/account");
  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-4xl">My Account</h1>
        <p className="mt-1 text-muted">{profile.email}</p>
      </div>
      <section className="card p-5" aria-labelledby="prof">
        <h2 id="prof" className="mb-4 text-2xl">Your Details</h2>
        <ProfileForm fullName={profile.full_name ?? ""} phone={profile.phone ?? ""} />
      </section>
    </div>
  );
}
