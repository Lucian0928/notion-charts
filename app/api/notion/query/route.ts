import { NextRequest, NextResponse } from "next/server";
import { fetchChartData, fetchChartDataMulti, applyAggregation } from "@/lib/notionData";

export async function GET(req: NextRequest) {
  const token =
    req.headers.get("x-notion-token") || process.env.NOTION_CHARTS_TOKEN;
  const databaseId      = req.nextUrl.searchParams.get("databaseId");
  const xField          = req.nextUrl.searchParams.get("xField");
  const yField          = req.nextUrl.searchParams.get("yField");
  const yFieldsRaw      = req.nextUrl.searchParams.get("yFields");
  const aggregationsRaw = req.nextUrl.searchParams.get("aggregations") || "";

  if (!token)
    return NextResponse.json({ error: "No token provided" }, { status: 401 });
  if (!databaseId || !xField)
    return NextResponse.json({ error: "Missing params" }, { status: 400 });

  try {
    if (yFieldsRaw) {
      const yFields      = yFieldsRaw.split(",").map(f => f.trim()).filter(Boolean);
      const aggregations = aggregationsRaw ? aggregationsRaw.split(",") : yFields.map(() => "sum");
      if (yFields.length === 0)
        return NextResponse.json({ error: "Missing params" }, { status: 400 });
      if (yFields.length === 1) {
        const raw  = await fetchChartData(token, databaseId, xField, yFields[0]);
        const agg  = applyAggregation(raw, aggregations[0] || "sum");
        return NextResponse.json({ data: agg.map(d => ({ x: d.x, [yFields[0]]: d.y })), yFields });
      }
      const data = await fetchChartDataMulti(token, databaseId, xField, yFields, aggregations);
      return NextResponse.json({ data, yFields });
    }

    if (!yField)
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    const aggregation = aggregationsRaw.split(",")[0] || "sum";
    const raw  = await fetchChartData(token, databaseId, xField, yField);
    const data = applyAggregation(raw, aggregation);
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
