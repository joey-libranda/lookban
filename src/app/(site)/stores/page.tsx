import type { Metadata } from "next";
import { StoreCard } from "@/components/store/StoreCard";
import { getStores } from "@/server/queries/catalog";

export const metadata: Metadata = {
  title: "Lucban stores",
  description: "Explore the local pasalubong stores of Lucban, Quezon and shop each store's products.",
};

export default async function StoresPage() {
  const stores = await getStores();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-4xl">Explore Lucban stores</h1>
      <p className="mt-1 max-w-2xl text-muted">Every store has its own page. Visit one to see everything it offers.</p>
      {stores.length === 0 ? (
        <p className="card mt-8 p-10 text-center text-muted">No stores are listed yet. Please check back soon.</p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
          {stores.map((s) => <li key={s.id} className="h-full"><StoreCard s={s} /></li>)}
        </ul>
      )}
    </div>
  );
}
