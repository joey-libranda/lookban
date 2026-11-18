import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminMessage } from "@/server/queries/admin";
import { setMessageReadAction } from "@/server/actions/admin";
import { ReplyForm } from "@/components/admin/ReplyForm";
import { formatDateTime } from "@/lib/utils/labels";
import { uuid } from "@/lib/validators/admin";

export const metadata: Metadata = { title: "Message · Admin" };

export default async function MessageThread({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const m = await getAdminMessage(id);
  if (!m) notFound();

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/admin/messages" className="text-sm font-semibold text-blue pop hover:text-orange">← Messages</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl">{m.subject}</h1>
          <p className="text-muted">{m.name} · <span className="break-all">{m.email}</span></p>
        </div>
        <form action={setMessageReadAction.bind(null, m.id, m.status === "new")}>
          <button className="btn-outline">{m.status === "new" ? "Mark as Read" : "Mark as New"}</button>
        </form>
      </div>

      <section className="card p-5" aria-label="Original Message">
        <p className="label">Received {formatDateTime(m.created_at)}</p>
        <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-cream p-4">{m.message}</p>
      </section>

      {m.replies.map((r) => (
        <section key={r.id} className="card border-l-4 border-l-orange p-5" aria-label="Your Reply">
          <p className="label">Replied {formatDateTime(r.created_at)} · Sent to {m.email}</p>
          <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-cream p-4">{r.body}</p>
        </section>
      ))}

      <ReplyForm messageId={m.id} toEmail={m.email} again={m.replies.length > 0} />
    </div>
  );
}
