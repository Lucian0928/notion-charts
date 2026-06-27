import { NextRequest, NextResponse } from "next/server";
import { fetchChartData } from "@/lib/notionData";

export async function GET(req: NextRequest) {
  const token =
    req.headers.get("x-notion-token") || process.env.NOTION_CHARTS_TOKEN;
  const databaseId = req.nextUrl.searchParams.get("databaseId");
  const xField     = req.nextUrl.searchParams.get("xField");
  const yField     = req.nextUrl.searchParams.get("yField");

  if (!token)
    return NextResponse.json({ error: "No token provided" }, { status: 401 });
  if (!databaseId || !xField || !yField)
    return NextResponse.json({ error: "Missing params" }, { status: 400 });

  try {
    const data = await fetchChartData(token, databaseId, xField, yField);
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
