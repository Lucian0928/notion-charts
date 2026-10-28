// Output hygiene for chart rendering. Chart labels, field names and colors come
// from Notion data and from stored chart configs, and both renderers (the
// dashboard's lib/chartSvg.ts and the embed's inline script) concatenate them
// into HTML/SVG strings that end up in innerHTML. Everything is cleaned here,
// once, before it reaches either renderer.

import type { ChartType } from "./types";

export const CHART_TYPES: readonly ChartType[] = ["line", "bar", "pie", "hbar", "doughnut", "radar"];
export const COLOR_MODES = ["single", "multi"] as const;
export const DEFAULT_COLOR = "#6366f1";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

// Hex, or rgb()/hsl() with only numbers, commas, dots, % and slashes. Anything
// else (quotes, angle brackets, url(), expression()) falls back to the default.
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|(?:rgb|hsl)a?\([0-9.,%\s/]+\))$/i;

export function safeColor(value: unknown, fallback: string = DEFAULT_COLOR): string {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  return COLOR_RE.test(v) ? v : fallback;
}

export function safeColors(values: unknown, fallback: string = DEFAULT_COLOR): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((v) => safeColor(v, fallback));
}

// Currency prefixes are short symbols ("$", "NT$", "CHF"); drop anything that
// could break out of text or an attribute.
export function safePrefix(value: unknown): string {
  return String(value ?? "").replace(/[<>&"'`\\]/g, "").slice(0, 8);
}

// Escapes every string value and every key. Keys are escaped too because
// multi-series rows are keyed by field name; callers must escape the matching
// field-name list with escapeHtml so lookups stay consistent.
export function escapeRows(rows: any[]): Record<string, any>[] {
  return (rows || []).map((row) => {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(row || {})) {
      out[escapeHtml(k)] = typeof v === "string" ? escapeHtml(v) : v;
    }
    return out;
  });
}
