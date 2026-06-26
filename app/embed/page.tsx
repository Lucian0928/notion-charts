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

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.slice(0, 10);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const yr = String(d.getFullYear()).slice(2);
  return `${months[d.getMonth()]} '${yr}`;
}

function renderSvgChart(data: { x: any; y: any }[], color: string) {
  const W = 800;
  const H = 280;
  const pad = { top: 24, right: 16, bottom: 44, left: 44 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  if (data.length === 0) return `<text fill="#64748b" x="50%" y="50%" text-anchor="middle" font-size="13">No data</text>`;

  const ys = data.map((d) => Number(d.y));
  const maxY = Math.max(...ys);

  // Y axis: always start at 0, end at next clean 0.1 above max
  const yMin = 0;
  const yMax = Math.ceil(maxY * 10) / 10 + 0.1;
  const yRange = yMax - yMin;

  const sx = (i: number) => (i / (data.length - 1)) * iW;
  const sy = (v: number) => iH - ((v - yMin) / yRange) * iH;

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(Number(d.y)).toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L${sx(data.length - 1).toFixed(1)},${iH} L${sx(0).toFixed(1)},${iH} Z`;

  const showDots = data.length <= 200;
  const dots = showDots
    ? data.map((d, i) => `<circle cx="${sx(i).toFixed(1)}" cy="${sy(Number(d.y)).toFixed(1)}" r="2.5" fill="${color}"/>`).join("")
    : "";

  // X labels: ~8 evenly spaced, formatted as "Jan '25"
  const labelCount = 8;
  const step = Math.max(1, Math.floor((data.length - 1) / (labelCount - 1)));
  const indices = new Set<number>();
  for (let k = 0; k < labelCount; k++) indices.add(Math.min(k * step, data.length - 1));
  indices.add(data.length - 1);

  const xLabels = [...indices].map((i) => {
    const x = sx(i);
    const anchor = i === 0 ? "start" : i === data.length - 1 ? "end" : "middle";
    const label = formatDateLabel(String(data[i].x));
    return `<text x="${x.toFixed(1)}" y="${iH + 30}" fill="#6b7280" font-size="10.5" text-anchor="${anchor}" font-family="ui-monospace,monospace">${label}</text>`;
  }).join("");

  // Y ticks: 0, 0.1, 0.2 ... up to yMax
  const tickStep = 0.1;
  const yTickValues: number[] = [];
  for (let v = 0; v <= yMax + 0.001; v = Math.round((v + tickStep) * 100) / 100) {
    yTickValues.push(v);
  }

  const yLabels = yTickValues.map((v) => {
    const y = sy(v);
    if (y < -2 || y > iH + 2) return "";
    return `
      <line x1="0" y1="${y.toFixed(1)}" x2="${iW}" y2="${y.toFixed(1)}" stroke="rgba(180,130,0,0.18)" stroke-width="1"/>
      <text x="-8" y="${(y + 3.5).toFixed(1)}" fill="#6b7280" font-size="10" text-anchor="end" font-family="ui-monospace,monospace">${v.toFixed(1)}</text>`;
  }).join("");

  const gradId = `g${color.replace(/[^a-z0-9]/gi, "")}`;

  return `
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.55"/>
        <stop offset="75%" stop-color="${color}" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${W}" height="${H}" fill="#111008" rx="0"/>
    <g transform="translate(${pad.left},${pad.top})">
      ${yLabels}
      <path d="${areaPath}" fill="url(#${gradId})"/>
      <path d="${linePath}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/>
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
        viewBox={`0 0 800 280`}
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
