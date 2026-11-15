"use client";

/**
 * Cart for visitors who are not logged in. Lives ONLY in this browser tab's sessionStorage, so it disappears
 * when the tab/browser is closed (by design). It stores product ids + quantities only - never prices.
 * Prices, stock and availability are always looked up on the server (see guestCartAction).
 */
export type GuestItem = { p: string; q: number };

const KEY = "lookban-guest-cart";
const EVENT = "lookban:guest-cart";

export function readGuestCart(): GuestItem[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter((i): i is GuestItem => typeof i?.p === "string" && Number.isInteger(i?.q) && i.q > 0).slice(0, 50);
  } catch {
    return []; // storage blocked or corrupt: behave like an empty cart
  }
}

export function writeGuestCart(items: GuestItem[]) {
  try {
    if (items.length) sessionStorage.setItem(KEY, JSON.stringify(items));
    else sessionStorage.removeItem(KEY);
  } catch { /* private mode etc.: cart just won't persist across pages */ }
  window.dispatchEvent(new Event(EVENT));
}

export const clearGuestCart = () => writeGuestCart([]);
export const guestCount = (items: GuestItem[]) => items.reduce((n, i) => n + i.q, 0);

/** Subscribe to cart changes (same tab). Returns an unsubscribe function. */
export function onGuestCartChange(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
