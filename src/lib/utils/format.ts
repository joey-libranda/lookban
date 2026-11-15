const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Format a number as Philippine pesos, e.g. 1234.5 -> "₱1,234.50". */
export const formatPeso = (n: number | string) => peso.format(Number(n));

export const LOW_STOCK_THRESHOLD = 10;

export type Availability = { label: string; tone: "ok" | "low" | "out" | "closed"; canBuy: boolean };

/**
 * One place that decides how stock and store status are described and whether buying is allowed.
 * `storeOpen` defaults to true for callers that only know the stock level.
 */
export function availability(stock: number, storeOpen = true): Availability {
  if (!storeOpen) return { label: "Store currently closed", tone: "closed", canBuy: false };
  if (stock <= 0) return { label: "Out of stock", tone: "out", canBuy: false };
  if (stock <= LOW_STOCK_THRESHOLD) return { label: `Only ${stock} left`, tone: "low", canBuy: true };
  return { label: "In stock", tone: "ok", canBuy: true };
}

/** Whole-number discount percentage for a promo, or null when there is no real discount. */
export function discountPercent(price: number, compareAt: number | null | undefined): number | null {
  if (compareAt == null || !(compareAt > price) || price < 0) return null;
  const pct = Math.round((1 - price / compareAt) * 100);
  return pct >= 1 ? pct : null;
}
