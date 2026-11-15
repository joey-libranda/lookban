import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "About LOOKBAN" };

export default function AboutPage() {
  return (
    <>
      {/* Hero: Pahiyas photo with a gradient (dark on the right, where the text is). */}
      <section className="relative isolate overflow-hidden bg-blue">
        <Image src="/images/pahiyas-festival.jpg" alt="A house in Lucban decorated with colorful kiping, rice and produce for the Pahiyas Festival" fill sizes="100vw" priority className="-z-10 object-cover" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-blue/40 bg-gradient-to-l from-blue/95 via-blue/75 to-blue/10 md:bg-transparent" />
        <div className="mx-auto flex min-h-[32rem] max-w-7xl items-center justify-end px-4 py-16 sm:px-6">
          <div className="max-w-2xl text-right text-white">
            <h1 className="text-5xl !text-white sm:text-6xl">About LOOKBAN</h1>
            <p className="mt-2 text-xl font-semibold text-yellow">Local finds, Lucban pride.</p>
            <p className="mt-6 text-lg leading-relaxed text-white/95">
              Lucban, Quezon is known for its food, crafts and culture, from longganisa and pancit habhab to kiping and the Pahiyas Festival. Many of these products come from small, family-run businesses that have been perfecting their recipes for generations, yet still depend on walk-in buyers, tourists and social media to reach their customers. LOOKBAN was created to give these local stores a shared home online. Instead of searching through separate pages and messages, shoppers can browse Lucban&apos;s pasalubong in one place, see who makes what, and discover family favorites they might never have found otherwise.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-white/95">
              On LOOKBAN you can compare the same product across different stores, such as the price and pack size of longganisa, or visit a store&apos;s own page to see everything it offers. Add items from several stores to a single cart and check out once, while each store prepares its own part of your order.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {/* Mission and vision: one card, end to end, two colors. */}
        <div className="grid overflow-hidden rounded-2xl shadow-md md:grid-cols-2">
          <section className="bg-blue p-8 text-white sm:p-10">
            <h2 className="text-3xl !text-yellow">Our mission</h2>
            <p className="mt-3 text-lg leading-relaxed text-white/95">To give local businesses in Lucban an accessible online platform to showcase their products and reach more customers, while promoting and preserving the town&apos;s culture, traditions and identity.</p>
          </section>
          <section className="bg-orange p-8 text-white sm:p-10">
            <h2 className="text-3xl !text-white">Our vision</h2>
            <p className="mt-3 text-lg leading-relaxed text-white/95">To become a trusted marketplace for authentic Lucban products that supports the growth of local businesses and celebrates the town&apos;s heritage.</p>
          </section>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <h2 className="text-3xl sm:text-4xl">Every pasalubong has a story.</h2>
          <p className="max-w-xl text-ink/80">Longganisa, miki, hardinera, biscuits and more, straight from the stores that make them.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link href="/shop" className="btn-primary">Shop now</Link>
            <Link href="/stores" className="btn-outline">Explore stores</Link>
          </div>
        </div>
      </div>
    </>
  );
}
