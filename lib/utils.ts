import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const formatCurrency = (value: number) => currency.format(value);

export const formatDate = (value: string | Date | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
        new Date(value),
      )
    : "—";

/** yyyy-mm-dd for <input type="date">, in UTC to match how dates are stored. */
export const toDateInput = (value: string | Date | null | undefined) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

export const initials = (name?: string | null, email?: string | null) => {
  const source = name?.trim() || email || "?";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

/** $1.38M — for headline figures where the full amount would overflow. */
export const formatCompactCurrency = (value: number) => compactCurrency.format(value);
