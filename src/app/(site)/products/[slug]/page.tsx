import { redirect } from "next/navigation";

/** Product details open as a pop-up now. Old /products/<slug> links land on the shop with the pop-up open. */
export default async function ProductRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/shop?product=${encodeURIComponent(slug)}`);
}
