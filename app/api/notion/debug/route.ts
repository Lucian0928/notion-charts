import { NextRequest, NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notion";

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-notion-token") || process.env.NOTION_CHARTS_TOKEN;
  const databaseId = req.nextUrl.searchParams.get("databaseId");
  const field = req.nextUrl.searchParams.get("field");

  if (!token || !databaseId || !field) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  try {
    const notion = getNotionClient(token);
    const res = await notion.databases.query({ database_id: databaseId, page_size: 10 });

    const sample = res.results.map((page: any) => {
      const prop = page.properties[field];
      return {
        title: Object.values(page.properties).find((p: any) => p.type === "title")
          // @ts-ignore
          ?.title?.[0]?.plain_text ?? page.id,
        raw: prop ?? null,
      };
    });

    return NextResponse.json({ sample });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
