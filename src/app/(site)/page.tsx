import Link from "next/link";
import { Store, Tags, Truck } from "lucide-react";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { HERO_PHOTOS } from "@/lib/hero";
import { ProductCarousel } from "@/components/home/ProductCarousel";
import { StoreCard } from "@/components/store/StoreCard";
import { PahiyasStrip } from "@/components/ui/PahiyasStrip";
import { isSupabaseConfigured } from "@/lib/env";
import { getFeaturedProducts, getHeroPhotos, getStores } from "@/server/queries/catalog";

export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-4xl">Almost there</h1>
        <p className="mt-3 text-muted">Supabase isn&apos;t configured. Copy <code>.env.example</code> to <code>.env.local</code> and add your project keys (see README).</p>
      </div>
    );
  }

  const [featured, stores, heroPhotos] = await Promise.all([getFeaturedProducts(8), getStores(), getHeroPhotos()]);

  return (
    <>
      {/* HERO: photos slide in the background; the headline and buttons stay still. */}
      <section className="relative">
        <HeroCarousel photos={heroPhotos.length ? heroPhotos : HERO_PHOTOS}>
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-widest text-yellow">Lucban, Quezon</p>
            <h1 className="mt-3 text-4xl !leading-none !tracking-[-0.05em] !text-white sm:text-5xl md:text-6xl lg:text-7xl">Lucban&apos;s best<br className="hidden sm:block" /> pasalubong, all in<br className="hidden sm:block" /> one place.</h1>
            <p className="mt-5 max-w-xl text-lg text-white/90">
              Longganisa, miki, broas and more from many family-run Lucban stores. Compare prices, pick the store you love, and check out in one cart.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/shop" className="btn-primary">Shop Now</Link>
              <Link href="/stores" className="btn border-2 border-white text-white hover:bg-white hover:text-blue">Explore Stores</Link>
            </div>
          </div>
        </HeroCarousel>
        <PahiyasStrip straddle />
      </section>

      {/* BESTSELLERS / FEATURED PRODUCTS */}
      {featured.items.length > 0 && (
        <ProductCarousel id="best-h" title={featured.isBestselling ? "Best Selling Products" : "Fresh on LOOKBAN"} items={featured.items} href="/shop" />
      )}

      {/* PROMO BANNER */}
      <section className="bg-orange text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-10 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl !text-white sm:text-4xl">One Cart, Many Lucban Stores.</h2>
            <p className="mt-1 max-w-xl text-white/90">Mix longganisa from one store with miki from another. Each store prepares its own part of your order.</p>
          </div>
          <Link href="/shop" className="btn bg-white text-blue hover:bg-yellow">Start Shopping</Link>
        </div>
      </section>

      {/* FEATURED STORES */}
      {stores.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6" aria-labelledby="stores-h">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 id="stores-h" className="text-3xl sm:text-4xl">Featured Local Stores</h2>
            <Link href="/stores" className="shrink-0 font-semibold text-blue pop hover:text-orange">All stores</Link>
          </div>
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
            {[...stores].filter((s) => s.product_count > 0).sort((a, b) => b.product_count - a.product_count).slice(0, 6).map((s) => <li key={s.id} className="h-full"><StoreCard s={s} /></li>)}
          </ul>
        </section>
      )}

      {/* DISCOVER LUCBAN */}
      <section className="relative bg-blue text-white">
        <div className="mx-auto grid grid-cols-1 max-w-7xl [&>*]:min-w-0 gap-10 px-4 py-14 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="text-4xl !text-yellow">Discover Lucban</h2>
            <p className="mt-4 text-lg text-white/90">Known for its Pahiyas Festival, when homes are decorated with colorful kiping, Lucban is also home to garlicky air-dried longganisa, miki noodles for pancit habhab, and heritage biscuits baked for generations.</p>
            <p className="mt-4 text-white/80">Behind each product is a small, family-run business. Shopping on LOOKBAN helps them reach customers beyond the town.</p>
            <Link href="/about" className="btn mt-6 bg-yellow text-blue hover:bg-white">Our Story</Link>
          </div>
          <ul className="grid gap-4 self-center">
            {[
              [Store, "Local first", "Every product is made by a Lucban business."],
              [Tags, "Compare easily", "See the same product from different stores side by side."],
              [Truck, "One checkout", "Buy from several stores at once; each ships its own part."],
            ].map(([Icon, title, text]) => {
              const I = Icon as typeof Store;
              return (
                <li key={title as string} className="flex gap-4 rounded-xl bg-white/10 p-4">
                  <I className="mt-0.5 size-6 shrink-0 text-yellow" aria-hidden />
                  <div><h3 className="!font-sans text-base font-bold !text-white">{title as string}</h3><p className="text-sm text-white/80">{text as string}</p></div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* CLOSING BAND: white, so the blue Discover band and the blue footer never touch. */}
      <section className="flush-footer relative bg-white" aria-labelledby="cta-h">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-14 text-center sm:px-6">
          <h2 id="cta-h" className="max-w-2xl text-3xl !font-display !font-normal !tracking-normal sm:text-4xl">Bring home a taste of Lucban.</h2>
          <p className="max-w-xl text-ink/80">Longganisa, miki, hardinera, biscuits and more, straight from the stores that make them.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link href="/shop" className="btn-primary">Shop Now</Link>
            <Link href="/stores" className="btn-outline">Explore Stores</Link>
          </div>
        </div>
      </section>
    </>
  );
}
