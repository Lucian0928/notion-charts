import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { MAX_BODY_BYTES, MAX_CHARTS, isValidChartId, parseChartConfig } from "@/lib/chartConfig";
import type { ChartConfig } from "@/lib/types";

const KEY = "nc_charts";

async function getAll(): Promise<any[]> {
  return (await kv.get<any[]>(KEY)) || [];
}

async function setAll(charts: any[]): Promise<void> {
  await kv.set(KEY, charts);
}

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

// Storage failures are logged, not echoed: the message can name internals.
const storageError = (where: string, e: unknown) => {
  console.error(`[api/charts] ${where} failed`, e);
  return bad("Storage error", 500);
};

// Reads the body with a size cap and parses it; an error response is returned
// instead of thrown so each handler can hand it straight back.
async function readJson(req: NextRequest): Promise<{ ok: true; body: unknown } | { ok: false; res: NextResponse }> {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return { ok: false, res: bad("Body too large", 413) };
  try {
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return { ok: false, res: bad("Invalid JSON") };
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (id !== null && !isValidChartId(id)) return bad("Invalid id");
  try {
    const charts = await getAll();
    if (id) {
      const chart = charts.find((c: any) => c.id === id);
      if (!chart) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ chart });
    }
    return NextResponse.json({ charts });
  } catch {
    return NextResponse.json({ charts: [], storage: "unavailable" });
  }
}

export async function POST(req: NextRequest) {
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const parsed = parseChartConfig(body.body, "create");
  if (!parsed.ok) return bad(parsed.error);
  const config = parsed.value as ChartConfig;

  try {
    const charts = await getAll();
    const idx = charts.findIndex((c: any) => c.id === config.id);
    if (idx >= 0) {
      charts[idx] = config;
    } else {
      if (charts.length >= MAX_CHARTS) return bad("Chart limit reached", 409);
      charts.push(config);
    }
    await setAll(charts);
    return NextResponse.json({ id: config.id });
  } catch (e) {
    return storageError("POST", e);
  }
}

export async function PUT(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return bad("Missing id");
  if (!isValidChartId(id)) return bad("Invalid id");

  const body = await readJson(req);
  if (!body.ok) return body.res;
  const parsed = parseChartConfig(body.body, "update");
  if (!parsed.ok) return bad(parsed.error);

  try {
    const charts = await getAll();
    const idx = charts.findIndex((c: any) => c.id === id);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
    charts[idx] = { ...charts[idx], ...parsed.value, id };
    await setAll(charts);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return storageError("PUT", e);
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return bad("Missing id");
  if (!isValidChartId(id)) return bad("Invalid id");
  try {
    const charts = await getAll();
    await setAll(charts.filter((c: any) => c.id !== id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return storageError("DELETE", e);
  }
}
