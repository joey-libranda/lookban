import Link from "next/link";
import { AvatarUploader } from "@/components/account/AvatarUploader";
import { ProfileForm } from "@/components/account/AccountForms";
import { DeleteAccountForm, PasswordForm, SignOutEverywhere } from "@/components/account/SecurityForms";
import type { Profile } from "@/types/db";

const when = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso)) : "Not available";

export function Section({ title, hint, children, danger }: { title: string; hint?: string; children: React.ReactNode; danger?: boolean }) {
  const id = title.toLowerCase().replace(/\W+/g, "-");
  return (
    <section className={`card p-5 ${danger ? "border-red-200" : ""}`} aria-labelledby={id}>
      <h2 id={id} className={`text-2xl ${danger ? "text-red-700" : ""}`}>{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** A big number that links somewhere; used on every role's overview. */
export function Tile({ label, value, note, href }: { label: string; value: number | string; note?: string; href: string }) {
  return (
    <Link href={href} className="card block p-4 pop hover:border-brand">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold text-brand">{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </Link>
  );
}

export function ProfileSection({ profile }: { profile: Profile }) {
  return (
    <>
      <Section title="Profile Photo">
        <AvatarUploader userId={profile.id} path={profile.avatar_path} name={profile.full_name} email={profile.email} />
      </Section>
      <Section title="Your Details" hint="Your email is your login, so it can't be changed here.">
        <div className="mb-4 sm:max-w-md">
          <p className="label">Email</p>
          <p className="input flex items-center bg-cream/60 text-muted" aria-readonly>{profile.email}</p>
        </div>
        <ProfileForm fullName={profile.full_name ?? ""} phone={profile.phone ?? ""} />
      </Section>
    </>
  );
}

export function SecuritySection({ profile, lastSignIn }: { profile: Profile; lastSignIn?: string | null }) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Section title="Change Password">
        <PasswordForm />
      </Section>
      <div className="space-y-5">
      <Section title="Where You're Logged In" hint={`Last sign-in: ${when(lastSignIn)}`}>
        <p className="mb-4 text-sm">If you used a shared or public computer, you can log out everywhere at once.</p>
        <SignOutEverywhere />
      </Section>
      {profile.role === "customer" && (
        <Section title="Danger Zone" danger>
          <DeleteAccountForm />
        </Section>
      )}
      </div>
    </div>
  );
}
