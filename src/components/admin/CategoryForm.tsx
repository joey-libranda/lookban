"use client";

import { ActionForm } from "./ActionForm";
import { TextArea, TextInput } from "./Inputs";
import type { FormState } from "@/server/actions/admin";

type C = { name: string; slug: string; description: string | null; sort_order: number };

export function CategoryForm({ action, category, submitLabel }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>; category?: C; submitLabel: string;
}) {
  return (
    <ActionForm action={action} submitLabel={submitLabel} className="space-y-4">
      {(e) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput placeholder="e.g. Longganisang Lucban" name="name" label="Name" defaultValue={category?.name} error={e.name} required />
            <TextInput placeholder="e.g. longganisang-lucban" name="slug" label="Web Address" defaultValue={category?.slug} error={e.slug} />
            <TextInput placeholder="e.g. 1" name="sort_order" label="Display Order" type="number" min="0" defaultValue={category?.sort_order ?? 0} error={e.sort_order} />
          </div>
          <TextArea placeholder="A short line about this category" name="description" label="Description" defaultValue={category?.description ?? ""} error={e.description} rows={2} />
        </>
      )}
    </ActionForm>
  );
}
