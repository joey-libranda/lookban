"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { formatPeso } from "@/lib/utils/format";
import { issueMessage, maxQuantity, type CartLine } from "@/lib/utils/cart";
import { removeCartItemAction, updateCartItemAction } from "@/server/actions/cart";

/**
 * One cart line with +/- and remove. For customers, changes go through server actions that re-check stock.
 * For visitors, `local` handlers update the browser-held cart instead (the server re-prices it on every load).
 */
export function CartLineRow({ line, local }: { line: CartLine; local?: { setQty: (q: number) => void; remove: () => void } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const p = line.product;
  const issue = issueMessage(line);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) setError(r.error ?? "Something went wrong.");
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
      router.refresh();
    });
  }

  return (
    <li className={`flex gap-4 py-4 ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-line bg-line/40 sm:size-24">
        <SafeImage src={p?.image?.url} alt={p?.image?.alt ?? p?.name ?? "Unavailable item"} sizes="96px" compact />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {p ? (
              <Link href={`/shop?product=${p.slug}`} className="font-semibold pop hover:text-orange">{p.name}</Link>
            ) : (
              <span className="font-semibold text-muted">Item no longer available</span>
            )}
            {p && <p className="text-sm text-muted">{[p.variant_label, p.weight].filter(Boolean).join(" · ")}</p>}
          </div>
          {p && <p className="shrink-0 font-bold text-blue">{formatPeso(p.price * line.quantity)}</p>}
        </div>
        {p && <p className="text-sm text-muted">{formatPeso(p.price)} each</p>}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {p && (
            <div role="group" aria-label={`Quantity for ${p.name}`} className="inline-flex items-center rounded-lg border border-line">
              <button type="button" aria-label="Decrease quantity" disabled={pending || line.quantity <= 1}
                      onClick={() => (local ? local.setQty(line.quantity - 1) : run(() => updateCartItemAction(line.itemId, line.quantity - 1)))} className="p-2 disabled:opacity-40"><Minus className="size-4" /></button>
              <span className="min-w-9 text-center text-sm font-semibold">{line.quantity}</span>
              <button type="button" aria-label="Increase quantity" disabled={pending || line.quantity >= maxQuantity(p.stock)}
                      onClick={() => (local ? local.setQty(line.quantity + 1) : run(() => updateCartItemAction(line.itemId, line.quantity + 1)))} className="p-2 disabled:opacity-40"><Plus className="size-4" /></button>
            </div>
          )}
          <button type="button" disabled={pending} onClick={() => (local ? local.remove() : run(() => removeCartItemAction(line.itemId)))}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-red-700 pop hover:text-red-900">
            <Trash2 className="size-4" aria-hidden /> Remove
          </button>
        </div>
        {(issue || error) && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{error ?? issue}</p>}
      </div>
    </li>
  );
}
