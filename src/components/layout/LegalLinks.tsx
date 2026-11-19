"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { LEGAL, type LegalKey } from "@/lib/legal";

/** Footer links that open the policy text in a pop-up (native <dialog>: Esc closes, focus stays inside). */
export function LegalLinks() {
  const ref = useRef<HTMLDialogElement>(null);
  const [key, setKey] = useState<LegalKey>("privacy");
  const doc = LEGAL[key];
  const items: [LegalKey, string][] = [["privacy", "Privacy Policy"], ["terms", "Terms and Conditions"], ["returns", "Return & Refund Policy"]];

  return (
    <>
      {items.map(([k, label]) => (
        <li key={k}>
          <button type="button" onClick={() => { setKey(k); ref.current?.showModal(); }} className="pop text-left text-white/85 hover:text-white">{label}</button>
        </li>
      ))}
      <dialog ref={ref} aria-labelledby="legal-title"
              onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
              className="m-auto max-h-[85vh] w-[min(42rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-gray-900/55">
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div>
              <h2 id="legal-title" className="text-2xl">{doc.title}</h2>
              <p className="text-xs text-muted">Last updated: {doc.updated}</p>
            </div>
            <button type="button" aria-label="Close" onClick={() => ref.current?.close()}
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted transition hover:scale-110 hover:bg-line hover:text-ink">
              <X className="size-4" aria-hidden />
            </button>
          </header>
          <div className="overflow-y-auto overscroll-contain px-6 py-4">
            {doc.sections.map(([h, paras], i) => (
              <section key={h} className={i ? "mt-5" : ""}>
                <h3 className="!font-sans text-base font-bold">{i + 1}. {h}</h3>
                {paras.map((t) => <p key={t} className="mt-1.5 text-sm leading-relaxed text-ink/85">{t}</p>)}
              </section>
            ))}
          </div>
          <footer className="border-t border-line p-4">
            <button type="button" onClick={() => ref.current?.close()} className="btn-primary w-full">Close</button>
          </footer>
        </div>
      </dialog>
    </>
  );
}
