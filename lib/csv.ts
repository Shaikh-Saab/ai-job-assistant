/**
 * RFC 4180 CSV. Cells that spreadsheet apps would run as formulas (=, +, -, @) are prefixed
 * with an apostrophe so a malicious job title can't execute in Excel or Sheets.
 */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM so Excel opens UTF-8 (e.g. "München", "€") correctly.
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
