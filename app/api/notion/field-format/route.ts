import { NextRequest, NextResponse } from "next/server";
import { fetchFieldFormat } from "@/lib/notionData";

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-notion-token") || process.env.NOTION_CHARTS_TOKEN;
  const databaseId = req.nextUrl.searchParams.get("databaseId");
  const field = req.nextUrl.searchParams.get("field");

  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });
  if (!databaseId || !field) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const result = await fetchFieldFormat(token, databaseId, field);
  return NextResponse.json(result);
}
