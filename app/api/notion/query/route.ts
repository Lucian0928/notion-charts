import { NextRequest, NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notion";

function extractValue(prop: any): string | number | null {
  if (!prop) return null;
  switch (prop.type) {
    case "title":
      return prop.title?.[0]?.plain_text || null;
    case "rich_text":
      return prop.rich_text?.[0]?.plain_text || null;
    case "number":
      return prop.number ?? null;
    case "date":
      return prop.date?.start || null;
    case "checkbox":
      return prop.checkbox ? 1 : 0;
    case "select":
      return prop.select?.name || null;
    case "multi_select":
      return prop.multi_select?.map((o: any) => o.name).join(", ") || null;
    case "status":
      return prop.status?.name || null;
    case "people":
      return prop.people?.[0]?.name || null;
    case "url":
      return prop.url || null;
    case "email":
      return prop.email || null;
    case "phone_number":
      return prop.phone_number || null;
    case "created_by":
      return prop.created_by?.name || null;
    case "last_edited_by":
      return prop.last_edited_by?.name || null;
    case "relation":
      return prop.relation?.length ?? null;
    case "unique_id":
      return prop.unique_id?.number ?? null;
    case "files":
      return prop.files?.length > 0 ? prop.files.length : null;
    case "formula": {
      const f = prop.formula;
      if (f?.type === "number") return f.number ?? null;
      if (f?.type === "string") return f.string || null;
      if (f?.type === "boolean") return f.boolean ? 1 : 0;
      if (f?.type === "date") return f.date?.start || null;
      return null;
    }
    case "rollup": {
      const r = prop.rollup;
      if (r?.type === "number") return r.number ?? null;
      if (r?.type === "date") return r.date?.start || null;
      if (r?.type === "array" && Array.isArray(r.array)) {
        const nums = r.array.map((item: any) => extractValue(item)).filter((v: any) => typeof v === "number");
        return nums.length > 0 ? nums.reduce((a: number, b: number) => a + b, 0) : null;
      }
      return null;
    }
    case "created_time":
      return prop.created_time || null;
    case "last_edited_time":
      return prop.last_edited_time || null;
    default:
      return null;
  }
}

export async function GET(req: NextRequest) {
  const token =
    req.headers.get("x-notion-token") || process.env.NOTION_CHARTS_TOKEN;
  const databaseId = req.nextUrl.searchParams.get("databaseId");
  const xField = req.nextUrl.searchParams.get("xField");
  const yField = req.nextUrl.searchParams.get("yField");

  if (!token) {
    return NextResponse.json({ error: "No token provided" }, { status: 401 });
  }
  if (!databaseId || !xField || !yField) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  try {
    const notion = getNotionClient(token);
    const pages: any[] = [];
    let cursor: string | undefined;

    do {
      const res = await notion.databases.query({
        database_id: databaseId,
        start_cursor: cursor,
        page_size: 100,
        sorts: [{ timestamp: "created_time", direction: "ascending" }],
      });
      pages.push(...res.results);
      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);

    const data = pages
      .map((page: any) => {
        const x = extractValue(page.properties[xField]);
        const y = extractValue(page.properties[yField]);
        return { x, y };
      })
      .filter((d) => d.x !== null && d.y !== null);

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
