import type { ChartType } from "./types";

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}

// Catmull-Rom spline → cubic bezier SVG path
function smoothLinePath(pts: [number, number][]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  if (pts.length === 2)
    return `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)} L${pts[1][0].toFixed(1)},${pts[1][1].toFixed(1)}`;

  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function smartTicks(maxY: number): number[] {
  if (maxY === 0) return [0];
  const rough = maxY / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / mag;
  const step = n < 1.5 ? mag : n < 3.5 ? 2 * mag : n < 7.5 ? 5 * mag : 10 * mag;
  const ticks: number[] = [];
  for (let v = 0; ticks.length <= 20; v = Math.round((v + step) * 1e9) / 1e9) {
    ticks.push(v);
    if (v >= maxY) break; // last tick must be >= maxY so no data point is clipped
  }
  return ticks;
}

function fmtTick(v: number): string {
  if (v >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  if (Number.isInteger(v)) return String(v);
  const r = Math.round(v * 1000) / 1000;
  return r % 1 === 0 ? String(r) : r.toFixed(r < 0.1 ? 3 : r < 1 ? 2 : 1);
}

function renderLineChart(rawData: { x: any; y: any }[], color: string): string {
  const data = [...rawData].sort((a, b) =>
    String(a.x) < String(b.x) ? -1 : String(a.x) > String(b.x) ? 1 : 0
  );

  const W = 800;
  const H = 320;

  if (data.length === 0)
    return `<text style="fill:var(--label)" x="50%" y="50%" text-anchor="middle" font-size="13">No data</text>`;

  // Decide X rotation before setting padding
  const xLabels = data.map((d) => formatDateLabel(String(d.x)));
  const maxLabelLen = Math.max(...xLabels.map((l) => l.length));
  const approxIW = W - 56 - 12;
  const approxEffective = Math.min(Math.max(6, Math.round(approxIW / 38)), data.length);
  const labelSpacing = approxIW / Math.max(1, approxEffective - 1);
  const rotateX = maxLabelLen * 5.5 > labelSpacing - 4;
  const pad = { top: 14, right: 12, bottom: rotateX ? 52 : 24, left: 56 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  const ys = data.map((d) => Number(d.y));
  const maxY = Math.max(...ys);
  const yTicks = smartTicks(maxY);
  const yRange = yTicks[yTicks.length - 1] || 1;

  const sx = (i: number) => (i / (data.length - 1)) * iW;
  const sy = (v: number) => iH - (v / yRange) * iH;

  const pts: [number, number][] = data.map((d, i) => [sx(i), sy(Number(d.y))]);
  const linePath = smoothLinePath(pts);
  const areaPath = `${linePath} L${sx(data.length - 1).toFixed(1)},${iH} L${sx(0).toFixed(1)},${iH} Z`;

  const showDots = data.length <= 200;
  const dots = showDots
    ? data.map((d, i) =>
        `<circle cx="${sx(i).toFixed(1)}" cy="${sy(Number(d.y)).toFixed(1)}" r="5" fill="var(--bg)" stroke="${color}" stroke-width="1.8"/>`
      ).join("")
    : "";

  const targetLabels = Math.max(6, Math.round(iW / 38));
  const effectiveCount = Math.min(targetLabels, data.length);
  const step = Math.max(1, Math.floor((data.length - 1) / (effectiveCount - 1)));
  const indices = new Set<number>();
  for (let k = 0; k < effectiveCount; k++) indices.add(Math.min(k * step, data.length - 1));
  indices.add(data.length - 1);
  const sortedIndices = [...indices].sort((a, b) => a - b);

  const xGridLines = sortedIndices.map((i) =>
    `<line x1="${sx(i).toFixed(1)}" y1="0" x2="${sx(i).toFixed(1)}" y2="${iH}" style="stroke:var(--grid)" stroke-width="1"/>`
  ).join("");

  const xLabelTexts = sortedIndices.map((i) => {
    const x = sx(i);
    const label = xLabels[i];
    if (rotateX) {
      return `<text transform="translate(${x.toFixed(1)},${iH + 12}) rotate(-45)" style="fill:var(--label)" font-size="8.5" text-anchor="end" font-family="ui-monospace,monospace">${label}</text>`;
    }
    return `<text x="${x.toFixed(1)}" y="${(iH + 16).toFixed(1)}" style="fill:var(--label)" font-size="8.5" text-anchor="middle" font-family="ui-monospace,monospace">${label}</text>`;
  }).join("");

  const yGridLines = yTicks.map((v) => {
    const y = sy(v);
    if (y < -2 || y > iH + 2) return "";
    return `<line x1="0" y1="${y.toFixed(1)}" x2="${iW}" y2="${y.toFixed(1)}" style="stroke:var(--grid)" stroke-width="1"/>`;
  }).join("");

  const yLabelTexts = yTicks.map((v) => {
    const y = sy(v);
    if (y < -2 || y > iH + 2) return "";
    const label = Number.isInteger(v) ? String(v) : fmtTick(v);
    return `<text x="-6" y="${(y + 3).toFixed(1)}" style="fill:var(--label)" font-size="8.5" text-anchor="end" font-family="ui-monospace,monospace">${label}</text>`;
  }).join("");

  return `
    <g transform="translate(${pad.left},${pad.top})">
      ${yGridLines}
      ${xGridLines}
      <path d="${areaPath}" fill="${color}" fill-opacity="0.18"/>
      <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>
      ${dots}
      ${xLabelTexts}
      ${yLabelTexts}
    </g>`;
}

function renderBarChart(rawData: { x: any; y: any }[], colors: string[]): string {
  const data = [...rawData].sort((a, b) =>
    String(a.x) < String(b.x) ? -1 : String(a.x) > String(b.x) ? 1 : 0
  );

  const W = 800;
  const H = 320;

  if (data.length === 0)
    return `<text style="fill:var(--label)" x="50%" y="50%" text-anchor="middle" font-size="13">No data</text>`;

  const n = data.length;
  const xLabels = data.map((d) => formatDateLabel(String(d.x)));
  const maxLabelLen = Math.max(...xLabels.map((l) => l.length));
  // Decide rotation before setting padding so bottom space is accurate
  const approxSlotW = (W - 56 - 12) / n;
  const rotateX = maxLabelLen * 5.5 > approxSlotW - 4;
  const pad = { top: 14, right: 12, bottom: rotateX ? 52 : 24, left: 56 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  const ys = data.map((d) => Number(d.y));
  const maxY = Math.max(...ys);
  const yTicks = smartTicks(maxY);
  const yRange = yTicks[yTicks.length - 1] || 1;

  const slotW = iW / n;
  const barPad = Math.min(slotW * 0.2, 10);
  const barW = Math.max(1, slotW - barPad * 2);
  const rx = Math.min(3, barW * 0.25);

  const sy = (v: number) => iH - (v / yRange) * iH;

  const bars = data.map((d, i) => {
    const c = colors[i % colors.length];
    const bx = i * slotW + barPad;
    const bh = Math.max(1, (Number(d.y) / yRange) * iH);
    const by = iH - bh;
    return `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${c}" fill-opacity="0.85" rx="${rx}"/>`;
  }).join("");

  const yGridLines = yTicks.map((v) => {
    const y = sy(v);
    if (y < -2 || y > iH + 2) return "";
    return `<line x1="0" y1="${y.toFixed(1)}" x2="${iW}" y2="${y.toFixed(1)}" style="stroke:var(--grid)" stroke-width="1"/>`;
  }).join("");
  const yLabelTexts = yTicks.map((v) => {
    const y = sy(v);
    if (y < -2 || y > iH + 2) return "";
    const label = Number.isInteger(v) ? String(v) : fmtTick(v);
    return `<text x="-6" y="${(y + 3).toFixed(1)}" style="fill:var(--label)" font-size="8.5" text-anchor="end" font-family="ui-monospace,monospace">${label}</text>`;
  }).join("");

  const maxLabels = Math.max(2, Math.floor(iW / 55));
  const step = Math.max(1, Math.ceil(n / maxLabels));
  const xLabelTexts = data.map((d, i) => {
    if (i % step !== 0 && i !== n - 1) return "";
    const cx = i * slotW + slotW / 2;
    const label = xLabels[i];
    if (rotateX) {
      return `<text transform="translate(${cx.toFixed(1)},${iH + 12}) rotate(-45)" style="fill:var(--label)" font-size="8.5" text-anchor="end" font-family="ui-monospace,monospace">${label}</text>`;
    }
    return `<text x="${cx.toFixed(1)}" y="${(iH + 16).toFixed(1)}" style="fill:var(--label)" font-size="8.5" text-anchor="middle" font-family="ui-monospace,monospace">${label}</text>`;
  }).join("");

  return `
    <g transform="translate(${pad.left},${pad.top})">
      ${yGridLines}
      ${bars}
      ${xLabelTexts}
      ${yLabelTexts}
    </g>`;
}

function renderPieChart(rawData: { x: any; y: any }[], colors: string[]): string {
  if (rawData.length === 0)
    return `<text style="fill:var(--label)" x="50%" y="50%" text-anchor="middle" font-size="13">No data</text>`;

  const agg: Record<string, number> = {};
  for (const d of rawData) {
    const key = String(d.x);
    agg[key] = (agg[key] || 0) + (Number(d.y) || 0);
  }
  const entries = Object.entries(agg);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0)
    return `<text style="fill:var(--label)" x="50%" y="50%" text-anchor="middle" font-size="13">No data</text>`;

  const W = 620, H = 500;
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(cx, cy) - 75;

  let slices = "";
  let labels = "";
  let angle = -Math.PI / 2;

  for (let i = 0; i < entries.length; i++) {
    const [name, value] = entries[i];
    const sweep = (value / total) * 2 * Math.PI;
    const endAngle = angle + sweep;
    const c = colors[i % colors.length];

    const x1 = cx + R * Math.cos(angle);
    const y1 = cy + R * Math.sin(angle);
    const x2 = cx + R * Math.cos(endAngle);
    const y2 = cy + R * Math.sin(endAngle);
    const large = sweep > Math.PI ? 1 : 0;

    slices += `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${c}" style="stroke:var(--bg);stroke-width:2;"/>`;

    if (sweep > 0.1) {
      const mid = angle + sweep / 2;
      const lx = cx + (R + 26) * Math.cos(mid);
      const ly = cy + (R + 26) * Math.sin(mid);
      const pct = ((value / total) * 100).toFixed(0) + "%";
      const anchor = lx > cx + 8 ? "start" : lx < cx - 8 ? "end" : "middle";
      const label = name.length > 16 ? name.slice(0, 15) + "…" : name;
      labels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" style="fill:var(--label)" font-size="11" text-anchor="${anchor}" font-family="ui-monospace,monospace">${label} ${pct}</text>`;
    }

    angle = endAngle;
  }

  return `<g>${slices}${labels}</g>`;
}

export function getViewBox(chartType: ChartType): string {
  return chartType === "pie" ? "0 0 620 500" : "0 0 800 320";
}

export const DEFAULT_MULTI_COLORS = [
  "#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#a855f7",
];

export function renderSvgChart(
  rawData: { x: any; y: any }[],
  color: string,
  chartType: ChartType = "line",
  colors?: string[],
): string {
  const resolvedColors = colors && colors.length > 0 ? colors : [color];
  if (chartType === "bar") return renderBarChart(rawData, resolvedColors);
  if (chartType === "pie") return renderPieChart(rawData, resolvedColors);
  return renderLineChart(rawData, resolvedColors[0]);
}
