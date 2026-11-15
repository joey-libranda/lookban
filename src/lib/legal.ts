export type LegalKey = "privacy" | "terms" | "returns";
export type LegalDoc = { title: string; updated: string; sections: [string, string[]][] };

/** Policy texts shown in pop-ups from the footer. Draft wording: review before going live. */
export const LEGAL: Record<LegalKey, LegalDoc> = {
  privacy: { title: "Privacy Policy", updated: "November 2026", sections: [
    ["Information we collect", ["When you create an account or place an order, we collect your name, email address, contact number and delivery address, together with the items you order. Visitors who check out as guests give the same order details without creating an account."]],
    ["How we use it", ["We use your information to process and deliver your orders, let you track them, show your order history and receipts, and contact you about an order. Passwords are handled by our authentication provider and are never visible to us."]],
    ["Who can see it", ["The store that prepares your order receives the details it needs to fulfil it (your name, contact number, delivery address and the items from that store). We do not sell your personal information."]],
    ["Storage and security", ["Your data is stored with our database provider, Supabase, and protected by access controls so that customers can only see their own records. No system is completely secure, so please keep your password private."]],
    ["Your choices", ["You can update your profile and delivery address from your account page. To ask for a copy or deletion of your data, contact us using the details on the Contact page."]],
    ["Changes", ["We may update this policy from time to time. The date above shows when it was last changed."]],
  ] },
  terms: { title: "Terms & Conditions", updated: "November 2026", sections: [
    ["About LOOKBAN", ["LOOKBAN is an online marketplace that brings together pasalubong stores in Lucban, Quezon. Products are sold by the individual stores shown on each listing, and each store prepares its own part of your order."]],
    ["Products and availability", ["Product details, prices and stock are set by the stores and may change without notice. Items may become unavailable; if that happens we will contact you about your order. Product photos are for illustration and packaging may vary."]],
    ["Prices and delivery fees", ["All prices are in Philippine pesos (₱). A delivery fee is charged per store in your order and is shown at checkout before you place the order. The final total is always calculated by the system when the order is placed."]],
    ["Orders and payment", ["An order is confirmed once you receive an order confirmation and receipt number. You can pay in cash on delivery. Online payment may be offered as an option; an order is not treated as paid until the store confirms it."]],
    ["Accounts", ["You are responsible for keeping your login details private and for the information you provide. Please give a correct contact number and delivery address so your order can reach you."]],
    ["Changes", ["We may update these terms from time to time. Continuing to use LOOKBAN after a change means you accept the updated terms."]],
  ] },
  returns: { title: "Return & Refund Policy", updated: "November 2026", sections: [
    ["Food products", ["Most LOOKBAN products are fresh or perishable food, so we cannot accept returns just because of a change of mind. Please check the product details, variant and quantity before ordering."]],
    ["Problems with your order", ["If your order arrives damaged, spoiled, incorrect or incomplete, contact us as soon as possible, ideally on the day it is delivered, with your receipt number and clear photos of the item and its packaging."]],
    ["What we can do", ["Depending on the problem, the store may replace the item or refund the amount for the affected item. We will confirm the outcome with you after reviewing your report."]],
    ["Cancellations", ["You can ask to cancel an order before the store starts preparing it. Contact us with your receipt number. Orders that are already being prepared or are out for delivery may not be cancelled."]],
    ["Refunds", ["Cash-on-delivery orders that qualify for a refund are refunded through an arrangement agreed with you. Refunds apply only to the affected items, not to the whole order."]],
    ["How to reach us", ["Use the details on the Contact page. Please include your receipt number and phone number so we can find your order quickly."]],
  ] },
};
