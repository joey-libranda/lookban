import type { Metadata } from "next";
import { CommissionSettingForm, SettingsForm } from "@/components/admin/SettingsForm";
import { HeroSlideList, HeroSlideUploader } from "@/components/admin/HeroSlides";
import { getAdminHeroSlides, getCommissionRateSetting, getShippingFeeSetting } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Settings · Admin" };

export default async function AdminSettings() {
  const [fee, rate, slides] = await Promise.all([getShippingFeeSetting(), getCommissionRateSetting(), getAdminHeroSlides()]);
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-4xl">Settings</h1>
      <section className="card max-w-xl p-5">
        <h2 className="text-2xl">Shipping</h2>
        <p className="mb-4 mt-1 text-sm text-muted">Charged once per store in an order. A store can override this on its own page. Existing orders keep the fee they were placed with.</p>
        <SettingsForm fee={fee} />
      </section>
      <section className="card max-w-xl p-5">
        <h2 className="text-2xl">Commission</h2>
        <p className="mb-4 mt-1 text-sm text-muted">LOOKBAN&apos;s share of each store&apos;s item sales (shipping is not included). It is earned only when that store&apos;s part of an order is Delivered. A store can have its own rate on its page. Existing orders keep the rate they were placed with.</p>
        <CommissionSettingForm rate={rate} />
      </section>
      <section className="space-y-4" aria-labelledby="hero-h">
        <div>
          <h2 id="hero-h" className="text-2xl">Hero photos</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            These photos slide in the card at the top of the home page, in the order shown. Use wide, bright photos (about 5:4) or promo banners.
            {slides.length === 0 && " Until you add a photo, the site shows its built-in Pahiyas photos."}
          </p>
        </div>
        <HeroSlideUploader />
        {slides.length > 0 && <HeroSlideList slides={slides} />}
      </section>
    </div>
  );
}
