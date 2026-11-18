/** Shows where a product is in the approval process. Approved products show their normal Active/Archived state instead. */
export function ApprovalBadge({ approval, status }: { approval: "approved" | "pending" | "rejected"; status: "active" | "archived" }) {
  if (approval === "pending") return <span className="rounded-full bg-yellow px-2 py-0.5 text-xs font-semibold text-ink">Awaiting Approval</span>;
  if (approval === "rejected") return <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">Needs Changes</span>;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status === "active" ? "bg-green-50 text-green-800" : "bg-line text-muted"}`}>{status === "active" ? "Active" : "Archived"}</span>;
}
