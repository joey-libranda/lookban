"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, FormNotice } from "@/components/ui/Field";
import { checkoutSchema, guestCheckoutSchema, type CheckoutValues, type GuestCheckoutValues } from "@/lib/validators/checkout";
import { placeOrderAction } from "@/server/actions/orders";
import { placeGuestOrderAction } from "@/server/actions/guest";
import { clearGuestCart, type GuestItem } from "@/lib/guest-cart";

/** `guest` = visitor checkout: the cart items come from this browser and the order is not tied to an account. */
export function CheckoutForm({ defaults, guest }: { defaults: Partial<CheckoutValues>; guest?: { items: GuestItem[] } }) {
  const router = useRouter();
  // The form's fields are the guest set (it adds email). Customers use the base schema: their email is the account's.
  const { register, handleSubmit, formState: { errors } } = useForm<GuestCheckoutValues>({
    resolver: zodResolver(guest ? guestCheckoutSchema : checkoutSchema) as unknown as Resolver<GuestCheckoutValues>,
    defaultValues: { province: "Quezon", city: "Lucban", payment_method: "cod", email: "", ...defaults },
  });
  const [pending, start] = useTransition();
  const [fail, setFail] = useState<{ error: string; fixInCart?: boolean } | null>(null);

  const onSubmit = (v: GuestCheckoutValues) => {
    setFail(null);
    start(async () => {
      try {
        if (guest) {
          const r = await placeGuestOrderAction(v, guest.items);
          if (!r.ok) { setFail(r); return; }
          clearGuestCart(); // the order exists now; the browser cart is done
          router.push(r.redirectTo);
          return;
        }
        // Customers: on success the action redirects to the confirmation page and never returns here.
        const r = await placeOrderAction(v);
        if (r) setFail(r);
      } catch {
        setFail({ error: "Couldn't reach the server. Check your connection and try again. Before retrying, check My orders in case it went through." });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
      <fieldset className="card space-y-4 p-5">
        <legend className="px-1 text-2xl font-heading font-bold tracking-tighter text-blue">Delivery details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" autoComplete="name" error={errors.full_name} {...register("full_name")} />
          <Field label="Mobile number" type="tel" autoComplete="tel" placeholder="09171234567" error={errors.phone} {...register("phone")} />
        </div>
        {guest && <Field label="Email" type="email" autoComplete="email" hint="We use it to contact you about your order." error={errors.email} {...register("email")} />}
        <Field label="House no. / street" autoComplete="address-line1" error={errors.line1} {...register("line1")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Barangay (optional)" error={errors.barangay} {...register("barangay")} />
          <Field label="City / municipality" autoComplete="address-level2" error={errors.city} {...register("city")} />
          <Field label="Province" autoComplete="address-level1" error={errors.province} {...register("province")} />
          <Field label="Postal code (optional)" inputMode="numeric" autoComplete="postal-code" error={errors.postal} {...register("postal")} />
        </div>
        <div>
          <label htmlFor="notes" className="label">Delivery notes (optional)</label>
          <textarea id="notes" rows={3} className="input" placeholder="Landmarks, preferred time, etc." {...register("notes")} />
          {errors.notes && <p role="alert" className="field-error">{errors.notes.message}</p>}
        </div>
      </fieldset>

      <fieldset className="card space-y-3 p-5">
        <legend className="px-1 text-2xl font-heading font-bold tracking-tighter text-blue">Payment method</legend>
        <label className="flex cursor-pointer gap-3 rounded-lg border border-line p-3 has-[:checked]:border-blue has-[:checked]:bg-blue-50">
          <input type="radio" value="cod" className="mt-1" {...register("payment_method")} />
          <span><span className="font-semibold">Cash on Delivery</span><br /><span className="text-sm text-muted">Pay in cash when your order arrives.</span></span>
        </label>
        <label className="flex cursor-pointer gap-3 rounded-lg border border-line p-3 has-[:checked]:border-blue has-[:checked]:bg-blue-50">
          <input type="radio" value="simulated_online" className="mt-1" {...register("payment_method")} />
          <span>
            <span className="font-semibold">Online payment</span><br />
            <span className="text-sm text-muted">Pay online for your order.</span>
          </span>
        </label>
        {errors.payment_method && <p role="alert" className="field-error">Choose a payment method</p>}
      </fieldset>

      {fail && (
        <FormNotice kind="error">
          {fail.error}{" "}
          {fail.fixInCart && <Link href="/cart" className="font-semibold pop hover:opacity-70">Go to cart</Link>}
        </FormNotice>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full sm:w-auto sm:px-10">
        {pending ? "Placing Your Order…" : "Place Order"}
      </button>
    </form>
  );
}
