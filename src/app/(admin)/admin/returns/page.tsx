import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { ReturnsTable } from "@/components/returns/ReturnParts";
import { listReturns } from "@/server/queries/returns";

export const metadata: Metadata = { title: "Returns" };

export default async function AdminReturnsPage() {
  await requireAdmin("/admin/returns");
  const rows = await listReturns();
  const todo = rows.filter((r) => r.status === "escalated" || r.status === "approved");
  return (
    <div className="space-y-6">
      <div><h1 className="text-4xl">Returns</h1><p className="mt-1 text-muted">Stores decide first. You make the final call when a customer disagrees. Refunds are records only; money is sent outside LOOKBAN.</p></div>
      <section aria-labelledby="todo-h" className="space-y-3"><h2 id="todo-h" className="text-2xl">Needs Attention</h2>
        <ReturnsTable rows={todo} base="/admin/returns" showCustomer empty="Nothing needs your attention." /></section>
      <section aria-labelledby="all-h" className="space-y-3"><h2 id="all-h" className="text-2xl">All Requests</h2>
        <ReturnsTable rows={rows} base="/admin/returns" showCustomer empty="No return requests yet." /></section>
    </div>
  );
}
