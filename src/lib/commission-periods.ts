/** Reporting periods for the commission report. Boundaries use Philippine time (UTC+8). Pure functions: safe on server and client. */
export type PeriodView = "today" | "week" | "month" | "year" | "all" | "range";
export const QUICK_VIEWS: { value: Exclude<PeriodView, "range">; label: string }[] = [
  { value: "today", label: "Today" }, { value: "week", label: "This Week" }, { value: "month", label: "This Month" },
  { value: "year", label: "This Year" }, { value: "all", label: "All Time" },
];

export type Period = { view: PeriodView; label: string; from: string | null; to: string | null; fromDate: string; toDate: string };

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const at = (date: string) => `${date}T00:00:00+08:00`;
const full = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const fmt = (date: string) => full.format(new Date(`${date}T00:00:00Z`));

/** Today's date in Manila as a UTC-midnight Date, so day arithmetic is simple. */
function todayManila(): Date {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return new Date(`${s}T00:00:00Z`);
}
const validDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(new Date(`${s}T00:00:00Z`)) === s;

/** Inclusive start and end dates ("YYYY-MM-DD") -> a Period (the end date is included in full). */
function make(view: PeriodView, label: string, from: string, to: string): Period {
  return { view, label, from: at(from), to: at(ymd(new Date(new Date(`${to}T00:00:00Z`).getTime() + DAY))), fromDate: from, toDate: to };
}

/** Turn ?view=&from=&to= into a range. Bad input falls back to this month. */
export function resolvePeriod(view?: string, from?: string, to?: string): Period {
  const t = todayManila(), today = ymd(t);
  if (view === "all") return { view: "all", label: "All time", from: null, to: null, fromDate: "", toDate: "" };
  if (view === "today") return make("today", `Today — ${fmt(today)}`, today, today);
  if (view === "week") {
    const mon = new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * DAY);
    const sun = new Date(mon.getTime() + 6 * DAY);
    return make("week", `This Week — ${fmt(ymd(mon))} to ${fmt(ymd(sun))}`, ymd(mon), ymd(sun));
  }
  if (view === "year") {
    const y = t.getUTCFullYear();
    return make("year", `This Year — ${y}`, `${y}-01-01`, `${y}-12-31`);
  }
  if (view === "range" && validDate(from) && validDate(to)) {
    const [a, b] = from! <= to! ? [from!, to!] : [to!, from!]; // a reversed range is swapped, not rejected
    return make("range", a === b ? fmt(a) : `${fmt(a)} to ${fmt(b)}`, a, b);
  }
  const first = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0));
  const name = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  return make("month", `This Month — ${name}`, ymd(first), ymd(last));
}

/** Query string that reproduces a period (used by the statement links). */
export const periodQuery = (p: Period) => (p.view === "range" ? `view=range&from=${p.fromDate}&to=${p.toDate}` : `view=${p.view}`);
