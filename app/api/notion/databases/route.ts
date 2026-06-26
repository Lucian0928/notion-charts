import { NextRequest, NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notion";

export async function GET(req: NextRequest) {
  const token =
    req.headers.get("x-notion-token") || process.env.NOTION_TOKEN;

  if (!token) {
    return NextResponse.json({ error: "No token provided" }, { status: 401 });
  }

  try {
    const notion = getNotionClient(token);
    const response = await notion.search({
      filter: { value: "database" as any, property: "object" },
      sort: { direction: "descending", timestamp: "last_edited_time" },
    });

    const databases = (response.results as any[])
      .filter((r) => r.object === "database")
      .map((db: any) => ({
        id: db.id,
        name: db.title?.[0]?.plain_text || "Untitled",
        properties: db.properties,
      }));

    return NextResponse.json({ databases });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
