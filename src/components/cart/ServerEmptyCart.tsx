"use client";

import { EmptyCartButton } from "@/components/cart/EmptyCartButton";
import { clearCartAction } from "@/server/actions/cart";

/** Client wrapper: functions can't be passed from the server cart page. */
export function ServerEmptyCart() {
  return <EmptyCartButton onEmpty={async () => { await clearCartAction(); }} />;
}
