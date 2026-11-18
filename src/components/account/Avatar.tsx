"use client";

import Image from "next/image";
import { useState } from "react";
import { avatarUrl, initials } from "@/lib/utils/avatar";

/** Round profile photo with an initials fallback (no photo yet, or it failed to load). */
export function Avatar({ path, name, email, size = 72 }: { path: string | null; name: string | null; email?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const url = avatarUrl(path);
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue font-heading font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {url && !failed ? (
        <Image src={url} alt={`${name ?? "Your"} profile photo`} fill sizes={`${size}px`} className="object-cover" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden>{initials(name, email)}</span>
      )}
    </span>
  );
}
