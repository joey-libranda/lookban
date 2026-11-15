"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HeroPhoto } from "@/lib/hero";

/**
 * Full-screen hero: the photos slide in the background, a left-to-right blue gradient keeps the text readable,
 * and the text/buttons (children) stay put. Arrows and dots sit inside the photo (bottom right).
 * Pauses on hover/focus and never moves by itself for people who prefer reduced motion.
 */
export function HeroCarousel({ photos, children }: { photos: HeroPhoto[]; children: React.ReactNode }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = photos.length;
  const go = useCallback((to: number) => setI(((to % n) + n) % n), [n]);

  useEffect(() => {
    if (paused || n < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 5000);
    return () => clearInterval(t);
  }, [paused, n]);

  return (
    <div aria-roledescription="carousel" aria-label="Photos of Lucban" className="relative min-h-[calc(100svh-4.5rem)] overflow-hidden bg-blue"
         onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
         onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="absolute inset-0 flex transition-transform duration-700 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${i * 100}%)` }}>
        {photos.map((p, idx) => (
          <Link key={`${p.src}-${idx}`} href={p.href} role="group" aria-roledescription="slide" aria-label={`${idx + 1} of ${n}: ${p.alt}`}
                aria-hidden={idx !== i} tabIndex={idx === i ? 0 : -1}
                className="relative block h-full w-full shrink-0 overflow-hidden">
            <Image src={p.src} alt="" fill sizes="100vw" priority={idx === 0} className="object-cover"
                   style={{ transform: `scale(${p.zoom ?? 1})`, objectPosition: p.position ?? "center" }} />
          </Link>
        ))}
      </div>

      {/* Left-to-right gradient (stronger on small screens where the text covers the whole photo). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-blue/30 bg-gradient-to-r from-blue/95 via-blue/65 to-transparent md:bg-transparent" />

      {/* Fixed text and buttons. Only the buttons take clicks; the rest lets the photo link through. */}
      <div className="pointer-events-none relative z-10 mx-auto flex min-h-[calc(100svh-4.5rem)] max-w-7xl items-center px-14 pb-20 pt-10 sm:px-24 [&_a]:pointer-events-auto">
        {children}
      </div>

      {n > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={() => go(i - 1)}
                  className="absolute left-2 top-1/2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white/80 backdrop-blur-sm transition hover:bg-white/35 hover:text-white sm:left-5 sm:size-12">
            <ChevronLeft className="size-6" strokeWidth={2} aria-hidden />
          </button>
          <button type="button" aria-label="Next photo" onClick={() => go(i + 1)}
                  className="absolute right-2 top-1/2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white/80 backdrop-blur-sm transition hover:bg-white/35 hover:text-white sm:right-5 sm:size-12">
            <ChevronRight className="size-6" strokeWidth={2} aria-hidden />
          </button>
          <div className="absolute inset-x-0 bottom-8 z-20 flex justify-center gap-2">
            {photos.map((p, idx) => (
              <button key={idx} type="button" aria-label={`Go to photo ${idx + 1}`} aria-current={idx === i} onClick={() => go(idx)}
                      className={`h-2.5 rounded-full shadow ring-1 ring-black/10 transition-all ${idx === i ? "w-8 bg-orange" : "w-2.5 bg-white hover:bg-yellow"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
