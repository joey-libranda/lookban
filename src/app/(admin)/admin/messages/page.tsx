import type { Metadata } from "next";
import { getAdminMessages } from "@/server/queries/admin";
import { deleteMessageAction, setMessageReadAction } from "@/server/actions/admin";
import { formatDateTime } from "@/lib/utils/labels";

export const metadata: Metadata = { title: "Messages · Admin" };

export default async function AdminMessages() {
  const rows = await getAdminMessages();
  return (
    <div className="space-y-5">
      <h1 className="text-4xl">Messages</h1>
      <p className="text-sm text-muted">Messages sent from the Contact page. Reply by email using the sender&apos;s address.</p>
      {rows.length === 0 && <p className="card p-8 text-center text-muted">No messages yet.</p>}
      <ul className="space-y-4">
        {rows.map((m) => (
          <li key={m.id} className={`card relative p-5 ${m.status === "new" ? "border-orange" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{m.subject} {m.status === "new" && <span className="ml-2 rounded-full bg-orange px-2 py-0.5 text-xs font-bold text-white">New</span>}</p>
                <p className="text-sm text-muted">
                  {m.name} · <a href={`mailto:${m.email}`} className="pop break-all text-blue hover:text-orange">{m.email}</a> · {formatDateTime(m.created_at)}
                </p>
              </div>
              <div className="flex gap-4 text-sm font-semibold">
                <form action={setMessageReadAction.bind(null, m.id, m.status === "new")}>
                  <button className="pop text-blue hover:text-orange">{m.status === "new" ? "Mark as Read" : "Mark as New"}</button>
                </form>
                <form action={deleteMessageAction.bind(null, m.id)}>
                  <button className="pop text-red-700 hover:text-red-900">Delete</button>
                </form>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words">{m.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
