import type { Metadata } from "next";
import { CommissionSettingForm, SettingsForm } from "@/components/admin/SettingsForm";
import { AboutHeroEditor, SocialLinksForm } from "@/components/admin/SiteSettings";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { getAboutHero, getSocialLinks } from "@/server/queries/site";
import { HeroSlideList, HeroSlideUploader } from "@/components/admin/HeroSlides";
import { getAdminHeroSlides, getCommissionRateSetting, getShippingFeeSetting } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Settings · Admin" };

export default async function AdminSettings() {
  const [fee, rate, slides, aboutHero, socials] = await Promise.all([getShippingFeeSetting(), getCommissionRateSetting(), getAdminHeroSlides(), getAboutHero(), getSocialLinks()]);
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4"><h1 className="text-4xl">Settings</h1><ThemeToggle /></div>
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-y-0">
      <section className="card p-5 lg:row-span-3 lg:grid lg:grid-rows-subgrid">
        <h2 className="text-2xl">Shipping</h2>
        <p className="mb-4 mt-1 text-sm text-muted">Charged once per store in an order. A store can override this on its own page. Existing orders keep the fee they were placed with.</p>
        <SettingsForm fee={fee} />
      </section>
      <section className="card p-5 lg:row-span-3 lg:grid lg:grid-rows-subgrid">
        <h2 className="text-2xl">Commission</h2>
        <p className="mb-4 mt-1 text-sm text-muted">LOOKBAN&apos;s share of each store&apos;s item sales (shipping is not included). It is earned only when that store&apos;s part of an order is Delivered. A store can have its own rate on its page. Existing orders keep the rate they were placed with.</p>
        <CommissionSettingForm rate={rate} />
      </section>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
      <section className="space-y-4 min-w-0" aria-labelledby="hero-h">
        <div>
          <h2 id="hero-h" className="text-2xl">Hero Photos</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            These photos slide in the card at the top of the home page, in the order shown. Use wide, bright photos (about 5:4) or promo banners.
            {slides.length === 0 && " Until you add a photo, the site shows its built-in Pahiyas photos."}
          </p>
        </div>
        <HeroSlideUploader />
        {slides.length > 0 && <HeroSlideList slides={slides} />}
      </section>
        <div className="space-y-6">
        <section className="card p-5" aria-labelledby="about-h">
          <h2 id="about-h" className="text-2xl">About Us Banner</h2>
          <p className="mb-4 mt-1 text-sm text-muted">The wide photo behind the heading on the About Us page.</p>
          <AboutHeroEditor url={aboutHero} />
        </section>
          <section className="card p-5" aria-labelledby="soc-h">
            <h2 id="soc-h" className="text-2xl">Social Links</h2>
            <p className="mb-4 mt-1 text-sm text-muted">The buttons in the website footer and on the Contact page.</p>
            <SocialLinksForm links={socials} />
          </section>
        </div>
      </div>
    </div>
  );
}
