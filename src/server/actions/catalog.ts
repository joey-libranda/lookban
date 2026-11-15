"use server";

import { getProductModal } from "@/server/queries/catalog";
import type { ProductModalData } from "@/types/catalog";

export type ProductModalResult = { ok: true; data: ProductModalData } | { ok: false; error: string };

/** Loads what the product pop-up shows. Read-only and public: Row Level Security decides what is visible. */
export async function getProductModalAction(slug: string): Promise<ProductModalResult> {
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,160}$/.test(slug)) return { ok: false, error: "This product isn't available." };
  try {
    const data = await getProductModal(slug);
    return data ? { ok: true, data } : { ok: false, error: "This product isn't available anymore." };
  } catch {
    return { ok: false, error: "Couldn't load this product. Please try again." };
  }
}
