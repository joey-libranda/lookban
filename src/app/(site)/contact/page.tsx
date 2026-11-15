import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { CONTACT } from "@/lib/site";
import { ContactForm } from "@/components/contact/ContactForm";
import { SocialLinks } from "@/components/layout/SocialLinks";

export const metadata: Metadata = { title: "Contact Us" };

export default function ContactPage() {
  const rows = [
    { icon: MapPin, label: "Address", value: CONTACT.address },
    CONTACT.phone && { icon: Phone, label: "Phone", value: CONTACT.phone },
    CONTACT.email && { icon: Mail, label: "Email", value: CONTACT.email },
    CONTACT.hours && { icon: Clock, label: "Office Hours", value: CONTACT.hours },
  ].filter(Boolean) as { icon: typeof MapPin; label: string; value: string }[];

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <h1 className="text-4xl">Let&apos;s Talk</h1>
        <p className="mt-3 max-w-md text-muted">Have questions about our products, delivery, or bulk orders? We are here to help. Reach out to us through any of the channels below.</p>
        <ul className="mt-8 space-y-5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-yellow/70 text-blue"><r.icon className="size-5" aria-hidden /></span>
              <div className="min-w-0">
                <p className="font-semibold">{r.label}</p>
                <p className="break-words text-sm text-muted">{r.value}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-8 font-semibold">Follow Us</p>
        <SocialLinks className="mt-3 [&_a]:bg-yellow/70 [&_a]:text-blue [&_a:hover]:bg-orange [&_a:hover]:text-white" />
      </div>

      <section className="card p-6 sm:p-8" aria-labelledby="msg-h">
        <h2 id="msg-h" className="text-3xl">Send us a Message</h2>
        <div className="mt-5"><ContactForm /></div>
      </section>
    </div>
  );
}
