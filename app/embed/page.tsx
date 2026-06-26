import { getNotionClient } from "@/lib/notion";
import { ChartType } from "@/lib/types";

interface Props {
  searchParams: Promise<{
    databaseId?: string;
    xField?: string;
    yField?: string;
    chartType?: string;
    color?: string;
    title?: string;
  }>;
}

function extractValue(prop: any): string | number | null {
  if (!prop) return null;
  switch (prop.type) {
    case "title": return prop.title?.[0]?.plain_text || null;
    case "rich_text": return prop.rich_text?.[0]?.plain_text || null;
    case "number": return prop.number ?? null;
    case "date": return prop.date?.start || null;
    case "checkbox": return prop.checkbox ? 1 : 0;
    case "select": return prop.select?.name || null;
    case "formula":
      const f = prop.formula;
      if (f?.type === "number") return f.number ?? null;
      if (f?.type === "string") return f.string || null;
      if (f?.type === "boolean") return f.boolean ? 1 : 0;
      return null;
    case "created_time": return prop.created_time || null;
    default: return null;
  }
}

async function fetchData(databaseId: string, xField: string, yField: string) {
  const token = process.env.NOTION_CHARTS_TOKEN;
  if (!token) throw new Error("NOTION_CHARTS_TOKEN not set");

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

  return pages
    .map((page: any) => ({
      x: extractValue(page.properties[xField]),
      y: extractValue(page.properties[yField]),
    }))
    .filter((d) => d.x !== null && d.y !== null);
}

function renderLineChart(
  data: { x: any; y: any }[],
  color: string,
  width = 800,
  height = 300
) {
  if (data.length === 0) return "<text fill='#64748b' x='50%' y='50%' text-anchor='middle'>No data</text>";

  const pad = { top: 20, right: 20, bottom: 40, left: 45 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;

  const ys = data.map((d) => Number(d.y));
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeY = maxY - minY || 1;

  const scaleX = (i: number) => (i / (data.length - 1)) * W;
  const scaleY = (v: number) => H - ((v - minY) / rangeY) * H;

  const points = data.map((d, i) => `${scaleX(i)},${scaleY(Number(d.y))}`).join(" ");

  // X axis labels (show ~6)
  const step = Math.max(1, Math.floor(data.length / 6));
  const xLabels = data
    .filter((_, i) => i % step === 0 || i === data.length - 1)
    .map((d, idx, arr) => {
      const i = data.indexOf(d);
      const x = scaleX(i);
      const label = String(d.x).slice(0, 10);
      return `<text x="${x}" y="${H + 20}" fill="#64748b" font-size="10" text-anchor="middle">${label}</text>`;
    })
    .join("");

  // Y axis labels (5 ticks)
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) => {
    const v = minY + (rangeY / (yTicks - 1)) * i;
    const y = scaleY(v);
    return `
      <line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
      <text x="-8" y="${y + 4}" fill="#64748b" font-size="10" text-anchor="end">${v.toFixed(2)}</text>`;
  }).join("");

  // Dots
  const dots = data
    .map((d, i) => `<circle cx="${scaleX(i)}" cy="${scaleY(Number(d.y))}" r="2.5" fill="${color}"/>`)
    .join("");

  return `
    <g transform="translate(${pad.left},${pad.top})">
      ${yLabels}
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
      ${dots}
      ${xLabels}
    </g>`;
}

export default async function EmbedPage({ searchParams }: Props) {
  const params = await searchParams;
  const {
    databaseId = "",
    xField = "",
    yField = "",
    chartType = "line",
    color = "#f59e0b",
    title = "",
  } = params;

  let data: { x: any; y: any }[] = [];
  let errorMsg = "";

  try {
    if (!databaseId || !xField || !yField) throw new Error("缺少設定參數");
    data = await fetchData(databaseId, xField, yField);
  } catch (e: any) {
    errorMsg = e.message;
  }

  const W = 800;
  const H = 300;
  const chartSvg = errorMsg
    ? `<text fill="#f87171" x="50%" y="50%" text-anchor="middle" font-size="14">${errorMsg}</text>`
    : renderLineChart(data, color, W, H);

  return (
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #0a0a0f; color: #e2e8f0; font-family: -apple-system, sans-serif; padding: 16px; }
          .title { font-size: 13px; font-weight: 500; margin-bottom: 10px; color: white; }
          .footer { font-size: 11px; color: #64748b; text-align: right; margin-top: 8px; }
          svg { width: 100%; height: auto; }
        `}</style>
      </head>
      <body>
        {title && <div className="title">{title}</div>}
        <svg viewBox={`0 0 ${W} ${H + 60}`} xmlns="http://www.w3.org/2000/svg"
          dangerouslySetInnerHTML={{ __html: chartSvg }} />
        <div className="footer">{data.length} 筆資料</div>
      </body>
    </html>
  );
}
