import Link from "next/link";
import { ProductLink } from "./ProductLink";
import { formatPeso } from "@/lib/utils/format";
import { unitPrice, type ProductGroup } from "@/lib/utils/compare";

/** Side-by-side listing of one product across stores, cheapest first. */
export function CompareTable({ group, currentId }: { group: ProductGroup; currentId?: string }) {
  const units = group.items.map(unitPrice);
  const comparable = units.every((u) => u) && new Set(units.map((u) => u!.unit)).size === 1;
  const lowestUnit = comparable ? Math.min(...units.map((u) => u!.value)) : null;
  const lowestPrice = Math.min(...group.items.map((i) => i.price));

  return (
    <section className="card overflow-hidden" aria-labelledby={`g-${group.key}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line bg-cream px-5 py-3">
        <h3 id={`g-${group.key}`} className="text-xl">{group.name}</h3>
        <p className="text-sm text-muted">
          {group.storeCount > 1 ? `${group.storeCount} stores` : "1 store"} - {group.items.length} {group.items.length === 1 ? "option" : "options"}
        </p>
      </header>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-5 py-2.5">Store</th>
              <th scope="col" className="px-3 py-2.5">Pack / variant</th>
              <th scope="col" className="px-3 py-2.5">Size</th>
              <th scope="col" className="w-24 px-3 py-2.5"><span className="sr-only">Lowest price</span></th>
              <th scope="col" className="px-3 py-2.5 text-right">Price</th>
              {comparable && <th scope="col" className="w-24 px-3 py-2.5"><span className="sr-only">Best value</span></th>}
              {comparable && <th scope="col" className="px-3 py-2.5 text-right">{units[0]!.unit}</th>}
              <th scope="col" className="px-3 py-2.5 text-right">Stock</th>
              <th scope="col" className="px-5 py-2.5"><span className="sr-only">View</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {group.items.map((p, i) => {
              const u = units[i];
              const isLowestUnit = comparable && u && Math.abs(u.value - lowestUnit!) < 1e-9;
              return (
                <tr key={p.id} className={`align-middle ${p.id === currentId ? "bg-sun/40" : ""}`}>
                  <td className="px-5 py-3 font-semibold">
                    <Link href={`/stores/${p.store.slug}`} className="text-brand pop hover:text-orange">{p.store.name}</Link>
                  </td>
                  <td className="px-3 py-3">{p.variant_label || "-"}</td>
                  <td className="px-3 py-3 text-muted">{[p.weight, p.quantity_per_pack].filter(Boolean).join(" - ") || "-"}</td>
                  <td className="px-3 py-3 text-right">
                    {p.price === lowestPrice && group.items.length > 1 && (
                      <span className="whitespace-nowrap rounded-full bg-yellow px-2 py-0.5 text-[11px] font-bold text-dark">Lowest</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-extrabold text-brand">{formatPeso(p.price)}</td>
                  {comparable && (
                    <td className="px-3 py-3 text-right">
                      {isLowestUnit && <span className="whitespace-nowrap rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-800">Best value</span>}
                    </td>
                  )}
                  {comparable && <td className="px-3 py-3 text-right">{formatPeso(u!.value)}</td>}
                  <td className="px-3 py-3 text-right font-semibold">{p.store.is_open ? p.stock : <span className="text-muted">Closed</span>}</td>
                  <td className="px-5 py-3 text-right">
                    {p.id === currentId
                      ? <span className="text-xs font-semibold text-muted">Viewing</span>
                      : <ProductLink slug={p.slug} className="btn-primary !px-3.5 !py-1.5 text-sm">View</ProductLink>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!comparable && group.items.length > 1 && (
        <p className="border-t border-line px-5 py-2.5 text-xs text-muted">
          Pack sizes are not listed in the same unit, so a unit price is not shown. Compare size and pack columns before choosing.
        </p>
      )}
    </section>
  );
}
