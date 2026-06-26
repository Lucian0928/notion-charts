import { NextRequest, NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notion";

const CONFIG_DB_NAME = "__nc_charts__";
let _dbId: string | null = process.env.NOTION_CHARTS_CONFIG_DB || null;

async function findOrCreateDb(): Promise<string | null> {
  if (_dbId) return _dbId;

  const token = process.env.NOTION_CHARTS_TOKEN;
  if (!token) return null;

  const notion = getNotionClient(token);

  try {
    // Look for existing config database
    const search = await notion.search({
      query: CONFIG_DB_NAME,
      filter: { property: "object", value: "database" } as any,
    });

    for (const result of search.results as any[]) {
      if (
        result.object === "database" &&
        (result.title as any[])?.[0]?.plain_text === CONFIG_DB_NAME
      ) {
        _dbId = result.id;
        return _dbId;
      }
    }

    // Not found – create it inside the first accessible page
    const pageSearch = await notion.search({
      filter: { property: "object", value: "page" } as any,
    });
    if (pageSearch.results.length === 0) return null;

    const parentId = (pageSearch.results[0] as any).id;
    const db = await (notion as any).databases.create({
      parent: { type: "page_id", page_id: parentId },
      title: [{ type: "text", text: { content: CONFIG_DB_NAME } }],
      properties: {
        Name: { title: {} },
        Config: { rich_text: {} },
      },
    });

    _dbId = db.id;
    return _dbId;
  } catch (e) {
    console.error("[charts] findOrCreateDb:", e);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const singleId = req.nextUrl.searchParams.get("id");

  // Single chart fetch
  if (singleId) {
    try {
      const notion = getNotionClient(process.env.NOTION_CHARTS_TOKEN!);
      const page = await notion.pages.retrieve({ page_id: singleId }) as any;
      const name = page.properties?.Name?.title?.[0]?.plain_text || "";
      const raw = page.properties?.Config?.rich_text?.[0]?.plain_text || "{}";
      return NextResponse.json({ chart: { id: page.id, name, ...JSON.parse(raw) } });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  const dbId = await findOrCreateDb();
  if (!dbId) return NextResponse.json({ charts: [], storage: "unavailable" });

  try {
    const notion = getNotionClient(process.env.NOTION_CHARTS_TOKEN!);
    const res = await notion.databases.query({ database_id: dbId, page_size: 100 });

    const charts = (res.results as any[])
      .map((page) => {
        const name = page.properties?.Name?.title?.[0]?.plain_text || "";
        const raw = page.properties?.Config?.rich_text?.[0]?.plain_text || "{}";
        try {
          return { id: page.id, name, ...JSON.parse(raw) };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return NextResponse.json({ charts });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const dbId = await findOrCreateDb();
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
