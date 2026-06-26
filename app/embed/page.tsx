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
    });
    pages.push(...res.results);
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  const raw = pages
    .map((page: any) => ({
      x: extractValue(page.properties[xField]),
      y: extractValue(page.properties[yField]),
    }))
    .filter((d) => d.x !== null && d.y !== null);

  // Sort by X value ascending (oldest → newest)
  return raw.sort((a, b) => String(a.x) < String(b.x) ? -1 : String(a.x) > String(b.x) ? 1 : 0);
}

function renderSvgChart(data: { x: any; y: any }[], color: string) {
  const W = 800;
  const H = 260;
  const pad = { top: 20, right: 20, bottom: 40, left: 48 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  if (data.length === 0) return `<text fill="#64748b" x="50%" y="50%" text-anchor="middle" font-size="13">No data</text>`;

  const ys = data.map((d) => Number(d.y));
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const range = maxY - minY || 1;
  const yPad = range * 0.1;
  const yMin = Math.max(0, minY - yPad);
  const yMax = maxY + yPad;
  const yRange = yMax - yMin;

  const sx = (i: number) => (i / (data.length - 1)) * iW;
  const sy = (v: number) => iH - ((v - yMin) / yRange) * iH;

  // Line path
  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(Number(d.y)).toFixed(1)}`)
    .join(" ");

  // Area path (line + close to bottom)
  const first = `${sx(0).toFixed(1)},${sy(Number(data[0].y)).toFixed(1)}`;
  const last = `${sx(data.length - 1).toFixed(1)},${sy(Number(data[data.length - 1].y)).toFixed(1)}`;
  const areaPath = `${linePath} L${sx(data.length - 1).toFixed(1)},${iH} L${sx(0).toFixed(1)},${iH} Z`;

  // Dots (only if not too many data points)
  const showDots = data.length <= 150;
  const dots = showDots
    ? data.map((d, i) => `<circle cx="${sx(i).toFixed(1)}" cy="${sy(Number(d.y)).toFixed(1)}" r="3" fill="${color}"/>`).join("")
    : "";

  // X axis labels (~7 evenly spaced)
  const labelCount = 7;
  const step = Math.max(1, Math.floor(data.length / (labelCount - 1)));
  const xLabels = data
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i % step === 0 || i === data.length - 1)
    .map(({ d, i }) => {
      const label = String(d.x).slice(0, 10);
      const x = sx(i);
      const anchor = i === 0 ? "start" : i === data.length - 1 ? "end" : "middle";
      return `<text x="${x.toFixed(1)}" y="${iH + 28}" fill="#64748b" font-size="10" text-anchor="${anchor}" font-family="monospace">${label}</text>`;
    })
    .join("");

  // Y axis grid lines and labels (6 ticks)
  const yTicks = 6;
  const yLabels = Array.from({ length: yTicks }, (_, i) => {
    const v = yMin + (yRange / (yTicks - 1)) * i;
    const y = sy(v);
    return `
      <line x1="0" y1="${y.toFixed(1)}" x2="${iW}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <text x="-8" y="${(y + 4).toFixed(1)}" fill="#64748b" font-size="10" text-anchor="end" font-family="monospace">${v.toFixed(2)}</text>`;
  }).join("");

  // Unique gradient ID to avoid conflicts
  const gradId = `grad_${color.replace("#", "")}`;

  return `
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <g transform="translate(${pad.left},${pad.top})">
      ${yLabels}
      <path d="${areaPath}" fill="url(#${gradId})"/>
      <path d="${linePath}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"/>
      ${dots}
      ${xLabels}
    </g>`;
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
    <div style={{ background: "#0d0d0d", padding: "12px 16px 8px", minHeight: "100vh" }}>
      {title && (
        <div style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 500, marginBottom: "8px", fontFamily: "sans-serif" }}>
          {title}
        </div>
      )}
      <svg
        viewBox={`0 0 800 260`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "auto", display: "block" }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
      {!errorMsg && (
        <div style={{ color: "#475569", fontSize: "10px", textAlign: "right", marginTop: "4px", fontFamily: "sans-serif" }}>
          {data.length} entries
        </div>
      )}
    </div>
  );
}
