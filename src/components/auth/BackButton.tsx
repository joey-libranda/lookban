"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/** Goes back to the page the visitor came from (or home if there is no history). */
export function BackButton() {
  const router = useRouter();
  return (
    <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
            className="pop mb-5 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-brand hover:text-orange">
      <ArrowLeft className="size-4" aria-hidden /> Back
    </button>
  );
}
