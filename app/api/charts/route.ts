import { NextRequest, NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notion";

// Only use Notion storage when the DB ID is explicitly configured.
// Without it, return storage:"unavailable" so the client falls back to localStorage.
function getDbId(): string | null {
  return process.env.NOTION_CHARTS_CONFIG_DB || null;
}

function parseChart(page: any) {
  const name = page.properties?.Name?.title?.[0]?.plain_text || "";
  const raw = page.properties?.Config?.rich_text?.[0]?.plain_text || "{}";
  try {
    return { id: page.id, name, ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const singleId = req.nextUrl.searchParams.get("id");

  if (singleId) {
    try {
      const notion = getNotionClient(process.env.NOTION_CHARTS_TOKEN!);
      const page = await notion.pages.retrieve({ page_id: singleId }) as any;
      return NextResponse.json({ chart: parseChart(page) });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  const dbId = getDbId();
  if (!dbId) return NextResponse.json({ charts: [], storage: "unavailable" });

  try {
    const notion = getNotionClient(process.env.NOTION_CHARTS_TOKEN!);
    const res = await notion.databases.query({ database_id: dbId, page_size: 100 });
    const charts = (res.results as any[]).map(parseChart).filter(Boolean);
    return NextResponse.json({ charts });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const dbId = getDbId();
  if (!dbId) return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });

  const { name, ...config } = await req.json();
  try {
    const notion = getNotionClient(process.env.NOTION_CHARTS_TOKEN!);
    const page = await notion.pages.create({
      parent: { database_id: dbId } as any,
      properties: {
        Name: { title: [{ text: { content: name } }] } as any,
        Config: { rich_text: [{ text: { content: JSON.stringify(config) } }] } as any,
      },
    });
    return NextResponse.json({ id: page.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const pageId = req.nextUrl.searchParams.get("id");
  if (!pageId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { name, ...config } = await req.json();
  try {
    const notion = getNotionClient(process.env.NOTION_CHARTS_TOKEN!);
    await notion.pages.update({
      page_id: pageId,
      properties: {
        Name: { title: [{ text: { content: name } }] } as any,
        Config: { rich_text: [{ text: { content: JSON.stringify(config) } }] } as any,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const pageId = req.nextUrl.searchParams.get("id");
  if (!pageId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const notion = getNotionClient(process.env.NOTION_CHARTS_TOKEN!);
    await notion.pages.update({ page_id: pageId, archived: true });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
