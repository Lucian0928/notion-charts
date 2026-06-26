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

  return raw.sort((a, b) => String(a.x) < String(b.x) ? -1 : String(a.x) > String(b.x) ? 1 : 0);
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.slice(0, 10);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}

function renderSvgChart(data: { x: any; y: any }[], color: string) {
  const W = 800;
  const H = 320;
  const pad = { top: 20, right: 20, bottom: 70, left: 48 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  if (data.length === 0) return `<text style="fill:var(--label)" x="50%" y="50%" text-anchor="middle" font-size="13">No data</text>`;

  const ys = data.map((d) => Number(d.y));
  const maxY = Math.max(...ys);
  const yMin = 0;
  const yMax = Math.ceil(maxY * 10) / 10 + 0.1;
  const yRange = yMax - yMin;

  const sx = (i: number) => (i / (data.length - 1)) * iW;
  const sy = (v: number) => iH - ((v - yMin) / yRange) * iH;

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(Number(d.y)).toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L${sx(data.length - 1).toFixed(1)},${iH} L${sx(0).toFixed(1)},${iH} Z`;

  // Hollow dots like notion2chart
  const showDots = data.length <= 200;
  const dots = showDots
    ? data.map((d, i) => `<circle cx="${sx(i).toFixed(1)}" cy="${sy(Number(d.y)).toFixed(1)}" r="5" fill="var(--bg)" stroke="${color}" stroke-width="1.8"/>`).join("")
    : "";

  // X labels rotated -45deg, ~10 evenly spaced
  const labelCount = 10;
  const step = Math.max(1, Math.floor((data.length - 1) / (labelCount - 1)));
  const indices = new Set<number>();
  for (let k = 0; k < labelCount; k++) indices.add(Math.min(k * step, data.length - 1));
  indices.add(data.length - 1);

  const xLabels = [...indices].map((i) => {
    const x = sx(i);
    const label = formatDateLabel(String(data[i].x));
    return `<text transform="translate(${x.toFixed(1)},${iH + 16}) rotate(-45)" style="fill:var(--label)" font-size="11" text-anchor="end" font-family="ui-monospace,monospace">${label}</text>`;
  }).join("");

  // Y ticks every 0.1
  const tickStep = 0.1;
  const yTickValues: number[] = [];
  for (let v = 0; v <= yMax + 0.001; v = Math.round((v + tickStep) * 100) / 100) yTickValues.push(v);

  const yLabels = yTickValues.map((v) => {
    const y = sy(v);
    if (y < -2 || y > iH + 2) return "";
    return `
      <line x1="0" y1="${y.toFixed(1)}" x2="${iW}" y2="${y.toFixed(1)}" style="stroke:var(--grid)" stroke-width="1"/>
      <text x="-10" y="${(y + 4).toFixed(1)}" style="fill:var(--label)" font-size="11" text-anchor="end" font-family="ui-monospace,monospace">${v.toFixed(1)}</text>`;
  }).join("");

  const gradId = `g${color.replace(/[^a-z0-9]/gi, "")}`;

  return `
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.65"/>
        <stop offset="70%" stop-color="${color}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.03"/>
      </linearGradient>
    </defs>
    <g transform="translate(${pad.left},${pad.top})">
      ${yLabels}
      <path d="${areaPath}" fill="url(#${gradId})"/>
      <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>
      ${dots}
      ${xLabels}
    </g>`;
}

const CSS = `
  :root { --bg: #191919; --grid: rgba(180,130,0,0.2); --label: #6b7280; --btn-bg: rgba(255,255,255,0.1); --btn-border: rgba(255,255,255,0.18); }
  html[data-theme="light"] { --bg: #ffffff; --grid: rgba(0,0,0,0.09); --label: #9ca3af; --btn-bg: rgba(0,0,0,0.06); --btn-border: rgba(0,0,0,0.14); }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: var(--bg); }
  .wrap { background: var(--bg); height: 100vh; display: flex; flex-direction: column; padding: 10px 14px 6px; position: relative; transition: background 0.25s; }
  .top-row { display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; margin-bottom: 4px; min-height: 36px; }
  .title { font-size: 13px; font-weight: 500; color: var(--label); font-family: -apple-system, sans-serif; }
  .footer { font-size: 10px; color: var(--label); text-align: right; margin-top: 4px; font-family: sans-serif; opacity: 0.7; flex-shrink: 0; }
  .toggle { width: 40px; height: 40px; border-radius: 50%; border: 1.5px solid var(--btn-border); background: var(--btn-bg); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; transition: background 0.2s, border-color 0.2s, transform 0.15s; line-height: 1; padding: 0; flex-shrink: 0; }
  .toggle:hover { transform: scale(1.1); opacity: 0.85; }
  .chart-svg { flex: 1; min-height: 0; width: 100%; display: block; }
`;

const INIT_SCRIPT = `
  (function(){
    var t = localStorage.getItem('nc_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  })();
`;

const TOGGLE_SCRIPT = `
  document.getElementById('themeBtn').addEventListener('click', function() {
    var html = document.documentElement;
    var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('nc_theme', next);
    this.textContent = next === 'dark' ? '☀️' : '🌙';
  });
`;

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
    ? `<text style="fill:#f87171" x="50%" y="50%" text-anchor="middle" font-size="13">${errorMsg}</text>`
    : renderSvgChart(data, color);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />
      <div className="wrap">
        <div className="top-row">
          {title ? <div className="title">{title}</div> : <span/>}
          <button id="themeBtn" className="toggle" title="切換明暗模式">☀️</button>
        </div>
        <svg className="chart-svg" viewBox="0 0 800 320" preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
          dangerouslySetInnerHTML={{ __html: svgContent }} />
        {!errorMsg && <div className="footer">{data.length} entries</div>}
      </div>
      <script dangerouslySetInnerHTML={{ __html: TOGGLE_SCRIPT }} />
    </>
  );
}
