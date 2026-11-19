import type { Metadata } from "next";
import Link from "next/link";
import { getAdminMessages } from "@/server/queries/admin";
import { deleteMessageAction } from "@/server/actions/admin";
import { formatDateTime } from "@/lib/utils/labels";

export const metadata: Metadata = { title: "Messages · Admin" };

export default async function AdminMessages() {
  const rows = await getAdminMessages();
  return (
    <div className="space-y-5">
      <h1 className="text-4xl">Messages</h1>
      <p className="text-sm text-muted">Messages sent from the Contact page. Open one to read it and reply.</p>
      {rows.length === 0 && <p className="card p-8 text-center text-muted">No messages yet.</p>}
      <ul className="space-y-3">
        {rows.map((m) => (
          <li key={m.id} className={`card p-4 ${m.status === "new" ? "border-orange" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">{m.subject}
                  {m.status === "new" && <span className="rounded-full bg-orange px-2 py-0.5 text-xs font-bold text-white">New</span>}
                  {m.reply_count > 0 && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-brand">Replied</span>}
                </p>
                <p className="text-sm text-muted">{m.name} · <span className="break-all">{m.email}</span> · {formatDateTime(m.created_at)}</p>
                <p className="mt-2 line-clamp-2 break-words text-sm">{m.message}</p>
              </div>
              <div className="flex items-center gap-3">
                <Link href={`/admin/messages/${m.id}`} className="btn-outline !px-3 !py-1.5 !text-sm">View &amp; Reply</Link>
                <form action={deleteMessageAction.bind(null, m.id)}>
                  <button className="pop text-sm font-semibold text-red-700 hover:text-red-900">Delete</button>
                </form>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
