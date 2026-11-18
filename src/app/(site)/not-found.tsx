import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-4xl">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-muted">The product or store may have been removed, or the link is incorrect.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/shop" className="btn-primary">Browse Products</Link>
        <Link href="/stores" className="btn-outline">See Stores</Link>
      </div>
    </div>
  );
}
