import { SORT_OPTIONS, type SortKey } from "@/types/catalog";

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** First value of a query param as a trimmed string (or undefined). */
export const param = (sp: RawSearchParams, key: string): string | undefined => {
  const v = Array.isArray(sp[key]) ? sp[key][0] : sp[key];
  const t = v?.trim();
  return t ? t : undefined;
};

export const parseSort = (v: string | undefined): SortKey =>
  SORT_OPTIONS.some((o) => o.value === v) ? (v as SortKey) : "newest";

export const parsePage = (v: string | undefined) => {
  const n = Number.parseInt(v ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 500) : 1;
};
