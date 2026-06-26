import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KEY = "nc_charts";

async function getAll(): Promise<any[]> {
  return (await kv.get<any[]>(KEY)) || [];
}

async function setAll(charts: any[]): Promise<void> {
  await kv.set(KEY, charts);
}

export async function GET(req: NextRequest) {
  try {
    const charts = await getAll();
    const id = req.nextUrl.searchParams.get("id");
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
  try {
    const config = await req.json();
    const charts = await getAll();
    const idx = charts.findIndex((c: any) => c.id === config.id);
    if (idx >= 0) charts[idx] = config;
    else charts.push(config);
    await setAll(charts);
    return NextResponse.json({ id: config.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  try {
    const update = await req.json();
    const charts = await getAll();
    const idx = charts.findIndex((c: any) => c.id === id);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
    charts[idx] = { ...charts[idx], ...update, id };
    await setAll(charts);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  try {
    const charts = await getAll();
    await setAll(charts.filter((c: any) => c.id !== id));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
