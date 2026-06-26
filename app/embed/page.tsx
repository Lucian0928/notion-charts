import { getNotionClient } from "@/lib/notion";

interface Props {
  searchParams: Promise<{
    databaseId?: string;
    xField?: string;
    yField?: string;
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

function renderSvgChart(data: { x: any; y: any }[], color: string) {
  const W = 760;
  const H = 220;
  const pad = { top: 16, right: 16, bottom: 36, left: 44 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  if (data.length === 0) return `<text fill="#64748b" x="50%" y="50%" text-anchor="middle" font-size="13">No data</text>`;

  const ys = data.map((d) => Number(d.y));
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const range = maxY - minY || 1;

  const sx = (i: number) => (i / (data.length - 1)) * iW;
  const sy = (v: number) => iH - ((v - minY) / range) * iH;

  const polyline = data.map((d, i) => `${sx(i)},${sy(Number(d.y))}`).join(" ");
  const dots = data.map((d, i) => `<circle cx="${sx(i)}" cy="${sy(Number(d.y))}" r="2.5" fill="${color}" opacity="0.9"/>`).join("");

  const step = Math.max(1, Math.floor(data.length / 6));
  const xLabels = data
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i % step === 0 || i === data.length - 1)
    .map(({ d, i }) => `<text x="${sx(i)}" y="${iH + 26}" fill="#64748b" font-size="10" text-anchor="middle">${String(d.x).slice(0, 10)}</text>`)
    .join("");

  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const v = minY + range * t;
    const y = sy(v);
    return `
      <line x1="0" y1="${y}" x2="${iW}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      <text x="-6" y="${y + 4}" fill="#64748b" font-size="10" text-anchor="end">${v.toFixed(2)}</text>`;
  }).join("");

  return `<g transform="translate(${pad.left},${pad.top})">${yLabels}<polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>${dots}${xLabels}</g>`;
}

export default async function EmbedPage({ searchParams }: Props) {
  const { databaseId = "", xField = "", yField = "", color = "#f59e0b", title = "" } = await searchParams;

  let data: { x: any; y: any }[] = [];
  let errorMsg = "";

  try {
    if (!databaseId || !xField || !yField) throw new Error("缺少設定參數");
    data = await fetchData(databaseId, xField, yField);
  } catch (e: any) {
    errorMsg = e.message;
  }

  const svgContent = errorMsg
    ? `<text fill="#f87171" x="50%" y="50%" text-anchor="middle" font-size="13">${errorMsg}</text>`
    : renderSvgChart(data, color);

  return (
    <div style={{ background: "#0a0a0f", padding: "16px", minHeight: "100vh" }}>
      {title && <div style={{ color: "white", fontSize: "13px", fontWeight: 500, marginBottom: "10px" }}>{title}</div>}
      <svg
        viewBox="0 0 760 280"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "auto" }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
      {!errorMsg && (
        <div style={{ color: "#64748b", fontSize: "11px", textAlign: "right", marginTop: "6px" }}>
          {data.length} 筆資料
        </div>
      )}
    </div>
  );
}
