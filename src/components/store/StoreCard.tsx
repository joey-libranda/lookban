import Link from "next/link";
import { MapPin } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import type { StoreData } from "@/types/catalog";

export function StoreCard({ s }: { s: StoreData }) {
  return (
    <article className="card flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
      <Link href={`/stores/${s.slug}`} className="block">
        <div className="relative aspect-[16/7] bg-line/40">
          <SafeImage src={s.cover_url} alt={`${s.name} cover`} sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" />
        </div>
      </Link>
      <div className="flex gap-3 px-4 pb-1 pt-3">
        <div className="relative -mt-10 size-14 shrink-0 overflow-hidden rounded-lg border-2 border-white bg-blue shadow">
          {s.logo_url
            ? <SafeImage src={s.logo_url} alt={`${s.name} logo`} sizes="56px" />
            : <span className="flex size-full items-center justify-center font-display text-xl text-white" aria-hidden>{s.name[0]}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg leading-snug" title={s.name}><Link href={`/stores/${s.slug}`} className="pop hover:text-orange">{s.name}</Link></h3>
          {s.address && <p className="mt-0.5 flex items-start gap-1 text-sm text-muted"><MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden /><span className="line-clamp-1">{s.address}</span></p>}
        </div>
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4">
        <p className="mb-3 line-clamp-2 min-h-10 text-sm text-ink/80">{s.description}</p>
        <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-sm">
          <span className="font-semibold text-blue">{s.product_count} {s.product_count === 1 ? "product" : "products"}</span>
          <span className="flex items-center gap-2">
            <span className={s.is_open ? "text-green-800" : "text-muted"}>{s.is_open ? "Open" : "Closed"}</span>
          </span>
        </div>
      </div>
    </article>
  );
}
