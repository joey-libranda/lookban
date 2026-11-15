import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Suspense } from "react";
import { ProductModalHost } from "@/components/product/ProductModal";
import { ToastProvider } from "@/components/ui/Toast";
import { ShopperProvider } from "@/components/shop/ShopperProvider";
import { getCurrentUser } from "@/lib/auth/guards";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentUser(); // cached per request, shared with the Header
  return (
    <ShopperProvider loggedIn={!!current} isAdmin={current?.profile.role === "admin"}>
      <ToastProvider>
        <Header />
        <main>{children}</main>
        <Footer />
        <Suspense fallback={null}><ProductModalHost /></Suspense>
      </ToastProvider>
    </ShopperProvider>
  );
}
