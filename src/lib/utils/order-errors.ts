// place_order() raises errors shaped "CODE:detail". Turn them into customer-friendly text.
export function friendlyOrderError(message: string | undefined | null): { text: string; fixInCart: boolean } {
  const raw = message ?? "";
  const m = raw.match(/([A-Z_]{4,}):([\s\S]*)$/);
  const code = m?.[1];
  const detail = m?.[2]?.trim();
  switch (code) {
    case "AUTH_REQUIRED": return { text: "Please log in to place your order.", fixInCart: false };
    case "ADMIN_NOT_ALLOWED": return { text: "Admin accounts manage LOOKBAN and cannot place orders. Use a customer account or check out as a guest while logged out.", fixInCart: false };
    case "ACCOUNT_DISABLED": return { text: "This account is disabled. Please contact support.", fixInCart: false };
    case "INVALID_INPUT": return { text: detail || "Please check your delivery details.", fixInCart: false };
    case "EMPTY_CART": return { text: "Your cart is empty.", fixInCart: true };
    case "UNAVAILABLE": return { text: `“${detail}” is no longer available. Please remove it from your cart.`, fixInCart: true };
    case "INSUFFICIENT_STOCK": return { text: `Not enough stock for “${detail}”. Please lower the quantity in your cart.`, fixInCart: true };
    default: return { text: "We couldn't place your order. Please try again.", fixInCart: false };
  }
}
