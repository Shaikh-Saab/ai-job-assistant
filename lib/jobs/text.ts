const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", bull: "•", middot: "·",
};

function decodeEntities(s: string) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/**
 * HTML → readable plain text. Greenhouse double-escapes its HTML (&lt;p&gt;), so entities are
 * decoded before and after stripping tags.
 */
export function htmlToText(html: string | null | undefined) {
  if (!html) return "";
  let s = decodeEntities(html);
  s = s
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|h[1-6]|li|ul|ol|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  return s
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/** Keep stored descriptions bounded; postings longer than this are rare and mostly boilerplate. */
export const clip = (s: string, max = 20_000) => (s.length > max ? `${s.slice(0, max)}…` : s);

/** Rough FX to USD so salaries from different countries can be compared. Approximate by design. */
const USD_PER: Record<string, number> = {
  USD: 1, GBP: 1.27, EUR: 1.08, CAD: 0.73, AUD: 0.66, NZD: 0.6, INR: 0.012, SGD: 0.74,
  CHF: 1.12, PLN: 0.25, BRL: 0.18, MXN: 0.055, ZAR: 0.054,
};

export const toUsd = (amount: number | null | undefined, currency: string) =>
  amount && USD_PER[currency] ? Math.round(amount * USD_PER[currency]) : null;

export const ADZUNA_CURRENCY: Record<string, string> = {
  gb: "GBP", us: "USD", au: "AUD", at: "EUR", be: "EUR", br: "BRL", ca: "CAD", ch: "CHF", de: "EUR",
  es: "EUR", fr: "EUR", in: "INR", it: "EUR", mx: "MXN", nl: "EUR", nz: "NZD", pl: "PLN", sg: "SGD", za: "ZAR",
};

/** First money figure in free text like "CA$215K – CA$295K" or "$90,000 - $120,000", as USD. */
export function parseSalaryText(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/(CA\$|A\$|NZ\$|S\$|US\$|\$|£|€|₹)\s?([\d,.]+)\s?(k|K)?/);
  if (!m) return null;
  const cur = { "CA$": "CAD", "A$": "AUD", "NZ$": "NZD", "S$": "SGD", "US$": "USD", $: "USD", "£": "GBP", "€": "EUR", "₹": "INR" }[m[1]] ?? "USD";
  let n = parseFloat(m[2].replace(/,/g, ""));
  if (m[3]) n *= 1000;
  if (n < 1000) return null; // hourly or per-task rates aren't comparable to annual pay
  return toUsd(n, cur);
}
