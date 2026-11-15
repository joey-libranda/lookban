import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { CONTACT } from "@/lib/site";
import { LegalLinks } from "./LegalLinks";
import { SocialLinks } from "./SocialLinks";

export function Footer() {
  return (
    <footer className="no-print mt-16 bg-blue text-white [main:has(.flush-footer)+&]:mt-0">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <Image src="/brand/lookban-wordmark-white.png" alt="LOOKBAN" width={140} height={36} />
          <p className="mt-3 text-sm text-white/80">Local finds, Lucban pride.</p>
          <p className="mt-2 max-w-xs text-sm text-white/70">Lucban&apos;s pasalubong stores and local delicacies, together in one online marketplace.</p>
          <SocialLinks className="mt-4" />
        </div>
        <FooterCol title="Quick links" links={[["/", "Home"], ["/about", "About Us"], ["/shop", "Shop"], ["/stores", "Stores"], ["/contact", "Contact Us"]]} />
        <div>
          <h2 className="!font-sans text-sm font-bold uppercase tracking-wide !text-yellow">Customer service</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/track" className="text-white/85 pop hover:text-white">Track Your Order</Link></li>
            <LegalLinks />
          </ul>
        </div>
        <div>
          <h2 className="!font-sans text-sm font-bold uppercase tracking-wide !text-yellow">Contact us</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-white/85">
            <li className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-yellow" aria-hidden />{CONTACT.address}</li>
            {CONTACT.phone && <li className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0 text-yellow" aria-hidden /><a href={`tel:${CONTACT.phone.replace(/\s/g, "")}`} className="pop hover:text-white">{CONTACT.phone}</a></li>}
            {CONTACT.email && <li className="flex gap-2"><Mail className="mt-0.5 size-4 shrink-0 text-yellow" aria-hidden /><a href={`mailto:${CONTACT.email}`} className="pop break-all hover:text-white">{CONTACT.email}</a></li>}
            <li><Link href="/contact" className="pop inline-block font-semibold text-yellow hover:text-white">Get in touch</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/15 py-4 text-center text-xs text-white/70">
        © {new Date().getFullYear()} LOOKBAN. All rights reserved.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h2 className="!font-sans text-sm font-bold uppercase tracking-wide !text-yellow">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map(([href, label]) => (
          <li key={href}><Link href={href} className="text-white/85 pop hover:text-white">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
