import type { Metadata } from "next";
import { requireVendor } from "@/lib/auth/guards";
import { ReturnsTable } from "@/components/returns/ReturnParts";
import { listReturns } from "@/server/queries/returns";

export const metadata: Metadata = { title: "Returns" };

export default async function VendorReturnsPage() {
  await requireVendor("/vendor/returns");
  const rows = await listReturns();
  const todo = rows.filter((r) => r.status === "requested" || r.status === "approved");
  return (
    <div className="space-y-6">
      <div><h1 className="text-4xl">Returns</h1><p className="mt-1 text-muted">Customers can ask for a return within a few days of delivery. Review each request and record the refund once it is sent.</p></div>
      <section aria-labelledby="todo-h" className="space-y-3"><h2 id="todo-h" className="text-2xl">Needs Your Action</h2>
        <ReturnsTable rows={todo} base="/vendor/returns" showCustomer empty="Nothing waiting for you." /></section>
      <section aria-labelledby="all-h" className="space-y-3"><h2 id="all-h" className="text-2xl">All Requests</h2>
        <ReturnsTable rows={rows} base="/vendor/returns" showCustomer empty="No return requests yet." /></section>
    </div>
  );
}
