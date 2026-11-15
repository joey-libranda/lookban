import { Star } from "lucide-react";

/** Renders only when real reviews exist. */
export function Rating({ rating }: { rating: { avg: number; count: number } | null }) {
  if (!rating) return null;
  return (
    <span className="inline-flex items-center gap-1 text-sm" aria-label={`Rated ${rating.avg.toFixed(1)} out of 5 from ${rating.count} reviews`}>
      <Star className="size-4 fill-orange text-orange" aria-hidden />
      <span className="font-semibold">{rating.avg.toFixed(1)}</span>
      <span className="text-muted">({rating.count})</span>
    </span>
  );
}
