"use client";

import { useRouter } from "next/navigation";

/** A table row that opens `href` when clicked anywhere (links/buttons inside still work on their own). */
export function ClickableRow({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr onClick={(e) => { if (!(e.target as HTMLElement).closest("a,button,input,select,textarea,label")) router.push(href); }}
        className="cursor-pointer transition-colors hover:bg-blue-50/60">
      {children}
    </tr>
  );
}
