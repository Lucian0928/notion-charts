import { NextRequest, NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notion";

export async function GET(req: NextRequest) {
  const token =
    req.headers.get("x-notion-token") || process.env.NOTION_TOKEN;
  const databaseId = req.nextUrl.searchParams.get("databaseId");

  if (!token) {
    return NextResponse.json({ error: "No token provided" }, { status: 401 });
  }
  if (!databaseId) {
    return NextResponse.json({ error: "No databaseId" }, { status: 400 });
  }

  try {
    const notion = getNotionClient(token);
    const db = await notion.databases.retrieve({ database_id: databaseId });

    const properties = Object.entries((db as any).properties).map(
      ([name, prop]: [string, any]) => ({
        id: prop.id,
        name,
        type: prop.type,
      })
    );

    return NextResponse.json({ properties });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
