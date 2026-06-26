import { NextRequest, NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notion";

export async function GET(req: NextRequest) {
  const report: Record<string, any> = {};

  const token = process.env.NOTION_CHARTS_TOKEN;
  report.has_token = !!token;
  if (!token) return NextResponse.json(report);

  const notion = getNotionClient(token);

  // 1. Test basic Notion connectivity
  try {
    const me = await (notion as any).users.me({});
    report.notion_user = me.name || me.id;
  } catch (e: any) {
    report.notion_error = e.message;
    return NextResponse.json(report);
  }

  // 2. Look for __nc_charts__ database
  try {
    const search = await notion.search({
      query: "__nc_charts__",
      filter: { property: "object", value: "database" } as any,
      page_size: 10,
    });
    const dbs = (search.results as any[]).filter(r =>
      r.object === "database" && r.title?.[0]?.plain_text === "__nc_charts__"
    );
    report.config_dbs_found = dbs.length;
    if (dbs.length > 0) {
      report.config_db_id = dbs[0].id;

      // 3. List charts in the database
      const pages = await notion.databases.query({ database_id: dbs[0].id, page_size: 20 });
      report.charts_in_db = pages.results.length;
      report.chart_pages = (pages.results as any[]).map(p => ({
        id: p.id,
        name: p.properties?.Name?.title?.[0]?.plain_text,
        config_snippet: p.properties?.Config?.rich_text?.[0]?.plain_text?.slice(0, 120),
      }));

      // 4. If ?id= passed, test fetching that specific page
      const testId = req.nextUrl.searchParams.get("id");
      if (testId) {
        try {
          const page = await notion.pages.retrieve({ page_id: testId }) as any;
          const raw = page.properties?.Config?.rich_text?.[0]?.plain_text || "{}";
          report.test_page = { id: page.id, raw_config: raw };
          try { report.test_page.parsed = JSON.parse(raw); } catch {}
        } catch (e: any) {
          report.test_page_error = e.message;
        }
      }
    }
  } catch (e: any) {
    report.search_error = e.message;
  }

  return NextResponse.json(report, {
    headers: { "Cache-Control": "no-store" },
  });
}
