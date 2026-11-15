import assert from "node:assert/strict";
import { test } from "node:test";
import { clampQuantity, computeCart, lineIssue, type CartLine } from "../src/lib/utils/cart.ts";
import { friendlyOrderError } from "../src/lib/utils/order-errors.ts";
import { paymentStatusLabel } from "../src/lib/utils/labels.ts";

const store = (id: string, fee: number | null = null, open = true) =>
  ({ id, slug: id, name: `Store ${id}`, is_open: open, shipping_fee: fee });
const line = (id: string, storeId: string, price: number, qty: number, stock = 50, fee: number | null = null, open = true): CartLine => ({
  itemId: id, quantity: qty,
  product: { id, slug: id, name: `P${id}`, variant_label: "", price, stock, weight: null, image: null, store: store(storeId, fee, open) },
});

test("clampQuantity respects stock and the 99 cap", () => {
  assert.equal(clampQuantity(5, 3), 3);
  assert.equal(clampQuantity(0, 10), 1);
  assert.equal(clampQuantity(-4, 10), 1);
  assert.equal(clampQuantity(500, 1000), 99);
  assert.equal(clampQuantity(2, 0), 0);
  assert.equal(clampQuantity(Number.NaN, 5), 1);
  assert.equal(clampQuantity(2.9, 5), 2);
});

test("one shipping fee per store, totals add up (matches place_order)", () => {
  // Mirrors the database test: 2 x 135 (store A) + 3 x 77 (store B) + 2 x 50 shipping = 601
  const t = computeCart([line("a", "A", 135, 2), line("b", "B", 77, 3)]);
  assert.equal(t.groups.length, 2);
  assert.equal(t.subtotal, 501);
  assert.equal(t.shipping, 100);
  assert.equal(t.total, 601);
  assert.equal(t.itemCount, 5);
});

test("two products from the same store share ONE shipping fee", () => {
  const t = computeCart([line("a", "A", 100, 1), line("b", "A", 50, 2)]);
  assert.equal(t.groups.length, 1);
  assert.equal(t.shipping, 50);
  assert.equal(t.total, 250);
});

test("per-store shipping override and floating point safety", () => {
  const t = computeCart([line("a", "A", 0.1, 3, 50, 0), line("b", "B", 0.2, 1, 50, 75)]);
  assert.equal(t.subtotal, 0.5);
  assert.equal(t.shipping, 75);
  assert.equal(t.total, 75.5);
});

test("issues are detected and block checkout", () => {
  assert.equal(lineIssue(line("a", "A", 10, 5, 3)), "insufficient_stock");
  assert.equal(lineIssue(line("a", "A", 10, 1, 0)), "out_of_stock");
  assert.equal(lineIssue(line("a", "A", 10, 1, 9, null, false)), "store_closed");
  assert.equal(lineIssue({ itemId: "x", quantity: 1, product: null }), "unavailable");
  assert.equal(computeCart([line("a", "A", 10, 1)]).hasIssues, false);
  assert.equal(computeCart([line("a", "A", 10, 9, 3)]).hasIssues, true);
  assert.equal(computeCart([{ itemId: "x", quantity: 1, product: null }]).unavailable.length, 1);
});

test("database errors become friendly messages", () => {
  const e = friendlyOrderError("INSUFFICIENT_STOCK:Lucban Longganisa");
  assert.match(e.text, /Lucban Longganisa/); assert.equal(e.fixInCart, true);
  assert.equal(friendlyOrderError("EMPTY_CART:Your cart is empty").fixInCart, true);
  assert.equal(friendlyOrderError("something weird").fixInCart, false);
  assert.doesNotMatch(friendlyOrderError("duplicate key value violates ...").text, /duplicate/);
});

test("simulated payments are never labelled paid", () => {
  assert.doesNotMatch(paymentStatusLabel("simulated", "simulated_online"), /^Paid/);
  assert.match(paymentStatusLabel("simulated", "simulated_online"), /^Pending$/);
  assert.match(paymentStatusLabel("pending", "cod"), /Unpaid/);
});
