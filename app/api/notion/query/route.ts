import { NextRequest, NextResponse } from "next/server";
import { fetchChartData, fetchChartDataMulti } from "@/lib/notionData";

export async function GET(req: NextRequest) {
  const token =
    req.headers.get("x-notion-token") || process.env.NOTION_CHARTS_TOKEN;
  const databaseId  = req.nextUrl.searchParams.get("databaseId");
  const xField      = req.nextUrl.searchParams.get("xField");
  const yField      = req.nextUrl.searchParams.get("yField");
  const yFieldsRaw  = req.nextUrl.searchParams.get("yFields");

  if (!token)
    return NextResponse.json({ error: "No token provided" }, { status: 401 });
  if (!databaseId || !xField)
    return NextResponse.json({ error: "Missing params" }, { status: 400 });

  try {
    if (yFieldsRaw) {
      const yFields = yFieldsRaw.split(",").map(f => f.trim()).filter(Boolean);
      if (yFields.length === 0)
        return NextResponse.json({ error: "Missing params" }, { status: 400 });
      if (yFields.length === 1) {
        const data = await fetchChartData(token, databaseId, xField, yFields[0]);
        return NextResponse.json({ data: data.map(d => ({ x: d.x, [yFields[0]]: d.y })), yFields });
      }
      const data = await fetchChartDataMulti(token, databaseId, xField, yFields);
      return NextResponse.json({ data, yFields });
    }

    if (!yField)
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    const data = await fetchChartData(token, databaseId, xField, yField);
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
