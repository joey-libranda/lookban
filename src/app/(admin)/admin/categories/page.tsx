import type { Metadata } from "next";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { getAdminCategoryOptions } from "@/server/queries/admin";
import { deleteCategoryAction, saveCategoryAction } from "@/server/actions/admin";

export const metadata: Metadata = { title: "Categories · Admin" };

export default async function AdminCategories() {
  const cats = await getAdminCategoryOptions();
  return (
    <div className="space-y-5">
      <h1 className="text-4xl">Categories</h1>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section className="card p-5"><h2 className="mb-3 text-2xl">Add Category</h2>
        <CategoryForm action={saveCategoryAction.bind(null, null)} submitLabel="Add Category" /></section>
      <div className="space-y-4">
      {cats.map((c) => (
        <details key={c.id} className="card p-5">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 font-semibold">
            <span>{c.name}</span>
            <span className="text-sm font-normal text-muted">/{c.slug} · order {c.sort_order}</span>
          </summary>
          <div className="mt-4 space-y-4">
            <CategoryForm action={saveCategoryAction.bind(null, c.id)} category={c} submitLabel="Save" />
            <ConfirmButton action={deleteCategoryAction.bind(null, c.id)} confirm={`Delete "${c.name}"? Its products become uncategorised.`} className="text-sm font-semibold text-red-700 pop hover:text-red-900">Delete category</ConfirmButton>
          </div>
        </details>
      ))}
      </div>
      </div>
    </div>
  );
}
