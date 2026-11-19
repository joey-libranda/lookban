/** Status of a permit from its expiry date (a calendar date, yyyy-mm-dd). Flag only - nothing is suspended automatically. */
export type DocStatus = "missing" | "expired" | "expiring" | "valid";
export const EXPIRING_DAYS = 30;

const today = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10); // Philippine date

export function daysUntil(expiry: string) {
  return Math.round((Date.parse(expiry) - Date.parse(today())) / 86_400_000);
}

export function docStatus(expiry: string | null | undefined): DocStatus {
  if (!expiry) return "missing";
  const d = daysUntil(expiry);
  return d < 0 ? "expired" : d <= EXPIRING_DAYS ? "expiring" : "valid";
}

export const DOC_STATUS_LABEL: Record<DocStatus, string> = { missing: "Not on File", expired: "Expired", expiring: "Expiring Soon", valid: "Verified" };
export const DOC_STATUS_TONE: Record<DocStatus, string> = {
  missing: "bg-red-100 text-red-800", expired: "bg-red-100 text-red-800", expiring: "bg-yellow text-dark", valid: "bg-green-100 text-green-900",
};
