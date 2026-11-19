"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  src: string | null | undefined;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  /** Tiny thumbnails: show a short tag instead of the full placeholder text. */
  compact?: boolean;
};

/**
 * Next/Image with a shimmer while loading and a clearly labelled placeholder when
 * there is no photo or it fails to load. The parent must be `relative` with a size/aspect ratio.
 */
export function SafeImage({ src, alt, sizes, priority, className = "", compact }: Props) {
  const [state, setState] = useState<"loading" | "ok" | "error">(src ? "loading" : "error");

  if (!src || state === "error") {
    if (compact) {
      return (
        <div role="img" aria-label={`${alt} (photo coming soon)`} className="absolute inset-0 flex items-center justify-center bg-sun/50 p-1 text-center">
          <span className="text-[10px] font-semibold uppercase leading-tight text-brand/80">Photo soon</span>
        </div>
      );
    }
    return (
      <div role="img" aria-label={`${alt} (photo coming soon)`}
           className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-sun/50 p-3 text-center">
        <span className="line-clamp-2 font-display text-lg leading-tight text-brand/80">{alt}</span>
        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-navy/70">Photo coming soon</span>
      </div>
    );
  }
  return (
    <>
      {state === "loading" && <div className="absolute inset-0 animate-pulse bg-line/60" aria-hidden />}
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority}
             className={`object-cover ${className}`}
             onLoad={() => setState("ok")} onError={() => setState("error")} />
    </>
  );
}
