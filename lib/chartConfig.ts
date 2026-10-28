// Validation for chart configs written through /api/charts. The route is
// reachable by anyone, so what it stores has to be bounded and well-formed:
// the embed and the dashboard later read these values back and render them.
// Only known fields are kept, strings and arrays are length-limited, and
// colors / prefix go through the same sanitizers the renderers use.

import type { ChartConfig } from "./types";
import { CHART_TYPES, COLOR_MODES, DEFAULT_COLOR, safeColor, safeColors, safePrefix } from "./sanitize";

export const MAX_CHARTS = 200;
export const MAX_BODY_BYTES = 32 * 1024;

const MAX_TEXT = 200;
const MAX_LIST = 24;
const MAX_AGGREGATION = 32;

// Existing charts use crypto.randomUUID(); allow any short URL-safe token so an
// older chart with a different id format can still be edited and deleted.
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
// Notion database ids: 32 hex characters, with or without dashes.
const DATABASE_ID_RE = /^[A-Za-z0-9-]{1,64}$/;

export const isValidChartId = (id: unknown): id is string => typeof id === "string" && ID_RE.test(id);

export type ParseResult =
  | { ok: true; value: Partial<ChartConfig> }
  | { ok: false; error: string };

const fail = (error: string): ParseResult => ({ ok: false, error });

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function text(v: unknown, max = MAX_TEXT): string | null {
  return typeof v === "string" && v.length <= max ? v : null;
}

function textList(v: unknown, itemMax: number): string[] | null {
  if (!Array.isArray(v) || v.length > MAX_LIST) return null;
  const out: string[] = [];
  for (const item of v) {
    const s = text(item, itemMax);
    if (s === null) return null;
    out.push(s);
  }
  return out;
}

// "create" requires the fields the dashboard always sends; "update" accepts any
// subset (the editor PUTs a partial config, and the route merges it).
export function parseChartConfig(input: unknown, mode: "create" | "update"): ParseResult {
  if (!isPlainObject(input)) return fail("Body must be a JSON object");

  const out: Partial<ChartConfig> = {};

  if (mode === "create") {
    if (!isValidChartId(input.id)) return fail("Invalid id");
    out.id = input.id;
  }

  if ("name" in input) {
    const v = text(input.name);
    if (v === null) return fail("Invalid name");
    out.name = v;
  }
  if ("databaseName" in input) {
    const v = text(input.databaseName);
    if (v === null) return fail("Invalid databaseName");
    out.databaseName = v;
  }
  if ("databaseId" in input) {
    if (typeof input.databaseId !== "string" || !DATABASE_ID_RE.test(input.databaseId)) {
      return fail("Invalid databaseId");
    }
    out.databaseId = input.databaseId;
  }
  if ("chartType" in input) {
    if (!(CHART_TYPES as readonly unknown[]).includes(input.chartType)) return fail("Invalid chartType");
    out.chartType = input.chartType as ChartConfig["chartType"];
  }
  // xField and yField are Notion property names; yField is "" when only yFields is used.
  for (const key of ["xField", "yField"] as const) {
    if (key in input) {
      const v = text(input[key]);
      if (v === null) return fail(`Invalid ${key}`);
      out[key] = v;
    }
  }
  if ("yFields" in input) {
    const v = textList(input.yFields, MAX_TEXT);
    if (v === null) return fail("Invalid yFields");
    out.yFields = v;
  }
  if ("yAggregations" in input) {
    const v = textList(input.yAggregations, MAX_AGGREGATION);
    if (v === null) return fail("Invalid yAggregations");
    out.yAggregations = v;
  }
  if ("startingPoint" in input) {
    const sp = input.startingPoint;
    if (sp !== "auto" && !(typeof sp === "number" && Number.isFinite(sp))) return fail("Invalid startingPoint");
    out.startingPoint = sp as ChartConfig["startingPoint"];
  }
  if ("color" in input) out.color = safeColor(input.color);
  if ("colors" in input) {
    if (!Array.isArray(input.colors) || input.colors.length > MAX_LIST) return fail("Invalid colors");
    out.colors = safeColors(input.colors);
  }
  if ("colorMode" in input) {
    if (!(COLOR_MODES as readonly unknown[]).includes(input.colorMode)) return fail("Invalid colorMode");
    out.colorMode = input.colorMode as ChartConfig["colorMode"];
  }
  if ("yPrefix" in input) out.yPrefix = safePrefix(input.yPrefix);
  if ("createdAt" in input) {
    if (typeof input.createdAt !== "number" || !Number.isFinite(input.createdAt)) return fail("Invalid createdAt");
    out.createdAt = input.createdAt;
  }

  if (mode === "create") {
    for (const key of ["name", "databaseId", "chartType", "xField", "yField"] as const) {
      if (out[key] === undefined) return fail(`Missing ${key}`);
    }
    // Older local charts may lack these; fill them so the stored shape is complete.
    out.databaseName ??= "";
    out.color ??= DEFAULT_COLOR;
    out.createdAt ??= Date.now();
  }

  return { ok: true, value: out };
}
