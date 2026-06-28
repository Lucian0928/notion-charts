import type { ChartType } from "./types";

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const day = String(d.getDate()).padStart(2, "0");
  return `${months[d.getMonth()]} ${day}, ${String(d.getFullYear()).slice(2)}`;
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

function resolveMinY(ys: number[], sp?: number | "auto"): number {
  if (sp === "auto") {
    const minVal = Math.min(...ys.filter(v => !isNaN(v)));
    if (minVal <= 0) return 0;
    const rough = minVal * 0.9;
    const mag = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1e-10))));
    return Math.floor(rough / mag) * mag;
  }
  if (typeof sp === "number") return sp;
  return 0;
}

function smartTicksFrom(minY: number, maxY: number): number[] {
  if (minY <= 0) return smartTicks(maxY);
  if (maxY <= minY) return [minY];
  const range = maxY - minY;
  const rough = range / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1e-10))));
  const n = rough / mag;
  const step = n < 1.5 ? mag : n < 3.5 ? 2 * mag : n < 7.5 ? 5 * mag : 10 * mag;
  const start = Math.floor(minY / step) * step;
  const ticks: number[] = [];
  for (let v = start; ticks.length <= 20; v = Math.round((v + step) * 1e9) / 1e9) {
    if (v >= minY - step * 0.01) ticks.push(v);
    if (v >= maxY) break;
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

function renderLineChart(rawData: { x: any; y: any }[], color: string, startingPoint?: number | "auto"): string {
  const data = [...rawData].sort((a, b) =>
    String(a.x) < String(b.x) ? -1 : String(a.x) > String(b.x) ? 1 : 0
  );

  const W = 800;
  const H = 320;

  if (data.length === 0)
    return `<text style="fill:var(--label)" x="50%" y="50%" text-anchor="middle" font-size="13">No data</text>`;

  // Decide X rotation before setting padding
  const lp = 56, rp = 12, F = 8.5;
  const xLabels = data.map((d) => formatDateLabel(String(d.x)));
  const maxLabelLen = Math.max(...xLabels.map((l) => l.length));
  const approxIW = W - lp - rp;
  const approxEffective = Math.min(Math.max(6, Math.round(approxIW / 38)), data.length);
  const labelSpacing = approxIW / Math.max(1, approxEffective - 1);
  const rotateX = maxLabelLen * (F * 0.6) > labelSpacing - 4;
  // Compute safe font size for rotated labels so leftmost label doesn't clip at x=0
  const xF = rotateX ? Math.max(5, Math.min(F, Math.floor(lp * 1.414 / (maxLabelLen * 0.65 + 1)))) : F;
  const pad = { top: 14, right: rp, bottom: rotateX ? Math.ceil(maxLabelLen * xF * 0.65 * 0.707) + 8 : F + 14, left: lp };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  const ys = data.map((d) => Number(d.y));
  const maxY = Math.max(...ys);
  const yFloor = resolveMinY(ys, startingPoint);
  const yTicks = smartTicksFrom(yFloor, maxY);
  const yCeil = yTicks[yTicks.length - 1] || 1;
  const ySpan = yCeil - yFloor || 1;

  const sx = (i: number) => (i / (data.length - 1)) * iW;
  const sy = (v: number) => iH - ((v - yFloor) / ySpan) * iH;

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
      return `<text transform="translate(${x.toFixed(1)},${iH + xF}) rotate(-45)" style="fill:var(--label)" font-size="${xF}" text-anchor="end" font-family="ui-monospace,monospace">${label}</text>`;
    }
    return `<text x="${x.toFixed(1)}" y="${(iH + F + 4).toFixed(1)}" style="fill:var(--label)" font-size="${F}" text-anchor="middle" font-family="ui-monospace,monospace">${label}</text>`;
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

function renderBarChart(rawData: { x: any; y: any }[], colors: string[], startingPoint?: number | "auto"): string {
  const data = [...rawData].sort((a, b) =>
    String(a.x) < String(b.x) ? -1 : String(a.x) > String(b.x) ? 1 : 0
  );

  const W = 800;
  const H = 320;

  if (data.length === 0)
    return `<text style="fill:var(--label)" x="50%" y="50%" text-anchor="middle" font-size="13">No data</text>`;

  const n = data.length;
  const lp2 = 56, rp2 = 12, F2 = 8.5;
  const xLabels = data.map((d) => formatDateLabel(String(d.x)));
  const maxLabelLen = Math.max(...xLabels.map((l) => l.length));
  // Decide rotation before setting padding so bottom space is accurate
  const approxSlotW = (W - lp2 - rp2) / n;
  const rotateX = maxLabelLen * (F2 * 0.6) > approxSlotW - 4;
  const xF2 = rotateX ? Math.max(5, Math.min(F2, Math.floor(lp2 * 1.414 / (maxLabelLen * 0.65 + 1)))) : F2;
  const pad = { top: 14, right: rp2, bottom: rotateX ? Math.ceil(maxLabelLen * xF2 * 0.65 * 0.707) + 8 : F2 + 14, left: lp2 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  const ys = data.map((d) => Number(d.y));
  const maxY = Math.max(...ys);
  const yFloor = resolveMinY(ys, startingPoint);
  const yTicks = smartTicksFrom(yFloor, maxY);
  const yCeil = yTicks[yTicks.length - 1] || 1;
  const ySpan = yCeil - yFloor || 1;

  const slotW = iW / n;
  const barPad = Math.min(slotW * 0.2, 10);
  const barW = Math.max(1, slotW - barPad * 2);
  const rx = Math.min(3, barW * 0.25);

  const sy = (v: number) => iH - ((v - yFloor) / ySpan) * iH;

  const bars = data.map((d, i) => {
    const c = colors[i % colors.length];
    const bx = i * slotW + barPad;
    const bh = Math.max(1, ((Number(d.y) - yFloor) / ySpan) * iH);
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
      return `<text transform="translate(${cx.toFixed(1)},${iH + xF2}) rotate(-45)" style="fill:var(--label)" font-size="${xF2}" text-anchor="end" font-family="ui-monospace,monospace">${label}</text>`;
    }
    return `<text x="${cx.toFixed(1)}" y="${(iH + F2 + 4).toFixed(1)}" style="fill:var(--label)" font-size="${F2}" text-anchor="middle" font-family="ui-monospace,monospace">${label}</text>`;
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

  const W = 800, H = 320;
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(cx, cy) - 45;

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

function renderMultiSeriesLineChart(
  rawData: Record<string, any>[],
  yFields: string[],
  colors: string[],
  startingPoint?: number | "auto",
): string {
  const data = [...rawData].sort((a, b) =>
    String(a.x) < String(b.x) ? -1 : String(a.x) > String(b.x) ? 1 : 0
  );
  const W = 800, H = 320;
  if (data.length === 0)
    return `<text style="fill:var(--label)" x="50%" y="50%" text-anchor="middle" font-size="13">No data</text>`;

  const lp = 56, rp = 12, F = 8.5;
  const xLabels = data.map((d) => formatDateLabel(String(d.x)));
  const maxLabelLen = Math.max(...xLabels.map((l) => l.length));
  const approxIW = W - lp - rp;
  const approxEffective = Math.min(Math.max(6, Math.round(approxIW / 38)), data.length);
  const labelSpacing = approxIW / Math.max(1, approxEffective - 1);
  const rotateX = maxLabelLen * (F * 0.6) > labelSpacing - 4;
  const xF = rotateX ? Math.max(5, Math.min(F, Math.floor(lp * 1.414 / (maxLabelLen * 0.65 + 1)))) : F;
  const pad = { top: 22, right: rp, bottom: rotateX ? Math.ceil(maxLabelLen * xF * 0.65 * 0.707) + 8 : F + 14, left: lp };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  const allY = data.flatMap((d) => yFields.map((yf) => Number(d[yf]) || 0));
  const maxY = Math.max(...allY, 0);
  const yFloor = resolveMinY(allY, startingPoint);
  const yTicks = smartTicksFrom(yFloor, maxY);
  const yCeil = yTicks[yTicks.length - 1] || 1;
  const ySpan = yCeil - yFloor || 1;

  const sx = (i: number) => (data.length > 1 ? i / (data.length - 1) : 0.5) * iW;
  const sy = (v: number) => iH - ((v - yFloor) / ySpan) * iH;

  const targetLabels = Math.max(6, Math.round(iW / 38));
  const effectiveCount = Math.min(targetLabels, data.length);
  const step = Math.max(1, Math.floor((data.length - 1) / Math.max(1, effectiveCount - 1)));
  const indices = new Set<number>();
  for (let k = 0; k < effectiveCount; k++) indices.add(Math.min(k * step, data.length - 1));
  indices.add(data.length - 1);
  const sortedIndices = [...indices].sort((a, b) => a - b);

  const xGridLines = sortedIndices.map((i) =>
    `<line x1="${sx(i).toFixed(1)}" y1="0" x2="${sx(i).toFixed(1)}" y2="${iH}" style="stroke:var(--grid)" stroke-width="1"/>`
  ).join("");
  const xLabelTexts = sortedIndices.map((i) => {
    const x = sx(i);
    if (rotateX)
      return `<text transform="translate(${x.toFixed(1)},${iH + xF}) rotate(-45)" style="fill:var(--label)" font-size="${xF}" text-anchor="end" font-family="ui-monospace,monospace">${xLabels[i]}</text>`;
    return `<text x="${x.toFixed(1)}" y="${(iH + F + 4).toFixed(1)}" style="fill:var(--label)" font-size="${F}" text-anchor="middle" font-family="ui-monospace,monospace">${xLabels[i]}</text>`;
  }).join("");
  const yGridLines = yTicks.map((v) => {
    const y = sy(v); if (y < -2 || y > iH + 2) return "";
    return `<line x1="0" y1="${y.toFixed(1)}" x2="${iW}" y2="${y.toFixed(1)}" style="stroke:var(--grid)" stroke-width="1"/>`;
  }).join("");
  const yLabelTexts = yTicks.map((v) => {
    const y = sy(v); if (y < -2 || y > iH + 2) return "";
    return `<text x="-6" y="${(y + 3).toFixed(1)}" style="fill:var(--label)" font-size="8.5" text-anchor="end" font-family="ui-monospace,monospace">${fmtTick(v)}</text>`;
  }).join("");

  const seriesSvg = yFields.map((yf, si) => {
    const c = colors[si % colors.length];
    const pts: [number, number][] = data.map((d, i) => [sx(i), sy(Number(d[yf]) || 0)]);
    const linePath = smoothLinePath(pts);
    const areaPath = `${linePath} L${sx(data.length - 1).toFixed(1)},${iH} L${sx(0).toFixed(1)},${iH} Z`;
    const dots = data.length <= 200
      ? data.map((d, i) => `<circle cx="${sx(i).toFixed(1)}" cy="${sy(Number(d[yf]) || 0).toFixed(1)}" r="4" fill="var(--bg)" stroke="${c}" stroke-width="1.8"/>`).join("")
      : "";
    return `<path d="${areaPath}" fill="${c}" fill-opacity="${yFields.length > 1 ? 0.08 : 0.18}"/>
<path d="${linePath}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"/>${dots}`;
  }).join("");

  const legend = yFields.map((yf, si) => {
    const c = colors[si % colors.length];
    const label = yf.length > 14 ? yf.slice(0, 13) + "…" : yf;
    return `<g transform="translate(${si * (iW / yFields.length)},${-10})">
      <circle cx="6" cy="0" r="3.5" fill="${c}"/>
      <text x="13" y="3.5" style="fill:var(--label)" font-size="8" font-family="ui-monospace,monospace">${label}</text>
    </g>`;
  }).join("");

  return `<g transform="translate(${pad.left},${pad.top})">${yGridLines}${xGridLines}${seriesSvg}${xLabelTexts}${yLabelTexts}${legend}</g>`;
}

function renderMultiSeriesBarChart(
  rawData: Record<string, any>[],
  yFields: string[],
  colors: string[],
  startingPoint?: number | "auto",
): string {
  const data = [...rawData].sort((a, b) =>
    String(a.x) < String(b.x) ? -1 : String(a.x) > String(b.x) ? 1 : 0
  );
  const W = 800, H = 320;
  if (data.length === 0)
    return `<text style="fill:var(--label)" x="50%" y="50%" text-anchor="middle" font-size="13">No data</text>`;

  const n = data.length, nS = yFields.length;
  const lp = 56, rp = 12, F = 8.5;
  const xLabels = data.map((d) => formatDateLabel(String(d.x)));
  const maxLabelLen = Math.max(...xLabels.map((l) => l.length));
  const approxSlotW = (W - lp - rp) / n;
  const rotateX = maxLabelLen * (F * 0.6) > approxSlotW - 4;
  const xF = rotateX ? Math.max(5, Math.min(F, Math.floor(lp * 1.414 / (maxLabelLen * 0.65 + 1)))) : F;
  const pad = { top: 22, right: rp, bottom: rotateX ? Math.ceil(maxLabelLen * xF * 0.65 * 0.707) + 8 : F + 14, left: lp };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  const allY = data.flatMap((d) => yFields.map((yf) => Number(d[yf]) || 0));
  const maxY = Math.max(...allY, 0);
  const yFloor = resolveMinY(allY, startingPoint);
  const yTicks = smartTicksFrom(yFloor, maxY);
  const yCeil = yTicks[yTicks.length - 1] || 1;
  const ySpan = yCeil - yFloor || 1;

  const slotW = iW / n;
  const groupPad = Math.min(slotW * 0.1, 4);
  const groupW = slotW - groupPad * 2;
  const barGap = 2;
  const barW = Math.max(1, (groupW - barGap * (nS - 1)) / nS);
  const rx = Math.min(3, barW * 0.25);
  const sy = (v: number) => iH - ((v - yFloor) / ySpan) * iH;

  const bars = data.map((d, i) => {
    const gx = i * slotW + groupPad;
    return yFields.map((yf, si) => {
      const c = colors[si % colors.length];
      const bx = gx + si * (barW + barGap);
      const val = Number(d[yf]) || 0;
      const bh = Math.max(1, ((val - yFloor) / ySpan) * iH);
      return `<rect x="${bx.toFixed(1)}" y="${(iH - bh).toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${c}" fill-opacity="0.85" rx="${rx}"/>`;
    }).join("");
  }).join("");

  const yGridLines = yTicks.map((v) => {
    const y = sy(v); if (y < -2 || y > iH + 2) return "";
    return `<line x1="0" y1="${y.toFixed(1)}" x2="${iW}" y2="${y.toFixed(1)}" style="stroke:var(--grid)" stroke-width="1"/>`;
  }).join("");
  const yLabelTexts = yTicks.map((v) => {
    const y = sy(v); if (y < -2 || y > iH + 2) return "";
    return `<text x="-6" y="${(y + 3).toFixed(1)}" style="fill:var(--label)" font-size="8.5" text-anchor="end" font-family="ui-monospace,monospace">${fmtTick(v)}</text>`;
  }).join("");
  const maxLabels = Math.max(2, Math.floor(iW / 55));
  const stepX = Math.max(1, Math.ceil(n / maxLabels));
  const xLabelTexts = data.map((d, i) => {
    if (i % stepX !== 0 && i !== n - 1) return "";
    const cx = i * slotW + slotW / 2;
    if (rotateX)
      return `<text transform="translate(${cx.toFixed(1)},${iH + xF}) rotate(-45)" style="fill:var(--label)" font-size="${xF}" text-anchor="end" font-family="ui-monospace,monospace">${xLabels[i]}</text>`;
    return `<text x="${cx.toFixed(1)}" y="${(iH + F + 4).toFixed(1)}" style="fill:var(--label)" font-size="${F}" text-anchor="middle" font-family="ui-monospace,monospace">${xLabels[i]}</text>`;
  }).join("");

  const legend = yFields.map((yf, si) => {
    const c = colors[si % colors.length];
    const label = yf.length > 14 ? yf.slice(0, 13) + "…" : yf;
    return `<g transform="translate(${si * (iW / yFields.length)},${-10})">
      <rect x="0" y="-5" width="9" height="9" rx="2" fill="${c}" fill-opacity="0.85"/>
      <text x="13" y="3.5" style="fill:var(--label)" font-size="8" font-family="ui-monospace,monospace">${label}</text>
    </g>`;
  }).join("");

  return `<g transform="translate(${pad.left},${pad.top})">${yGridLines}${bars}${xLabelTexts}${yLabelTexts}${legend}</g>`;
}

function renderHBarChart(rawData: { x: any; y: any }[], colors: string[], startingPoint?: number | "auto"): string {
  const data = [...rawData].sort((a, b) =>
    String(a.x) < String(b.x) ? -1 : String(a.x) > String(b.x) ? 1 : 0
  );
  const W = 800, H = 320;
  if (data.length === 0)
    return `<text style="fill:var(--label)" x="50%" y="50%" text-anchor="middle" font-size="13">No data</text>`;

  const n = data.length;
  const lp = 90, rp = 16, tp = 14, bp = 24;
  const iW = W - lp - rp;
  const iH = H - tp - bp;

  const ys = data.map(d => Number(d.y));
  const maxY = Math.max(...ys, 0);
  const xFloor = resolveMinY(ys, startingPoint);
  const xTicks = smartTicksFrom(xFloor, maxY);
  const xCeil = xTicks[xTicks.length - 1] || 1;
  const xSpan = xCeil - xFloor || 1;

  const slotH = iH / n;
  const barPad = Math.min(slotH * 0.2, 6);
  const barH = Math.max(1, slotH - barPad * 2);
  const rx = Math.min(3, barH * 0.25);

  const bars = data.map((d, i) => {
    const c = colors[i % colors.length];
    const by = i * slotH + barPad;
    const bw = Math.max(1, ((Number(d.y) - xFloor) / xSpan) * iW);
    return `<rect x="0" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${barH.toFixed(1)}" fill="${c}" fill-opacity="0.85" rx="${rx}"/>`;
  }).join("");

  const maxLabels = Math.max(2, Math.floor(iH / 20));
  const labelStep = Math.max(1, Math.ceil(n / maxLabels));
  const yLabelTexts = data.map((d, i) => {
    if (i % labelStep !== 0 && i !== n - 1) return "";
    const cy2 = i * slotH + slotH / 2;
    const label = String(d.x).length > 12 ? String(d.x).slice(0, 11) + "…" : String(d.x);
    return `<text x="-6" y="${(cy2 + 3.5).toFixed(1)}" style="fill:var(--label)" font-size="8" text-anchor="end" font-family="ui-monospace,monospace">${label}</text>`;
  }).join("");

  const xGridLines = xTicks.map(v => {
    const x = ((v - xFloor) / xSpan) * iW;
    if (x < -2 || x > iW + 2) return "";
    return `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${iH}" style="stroke:var(--grid)" stroke-width="1"/>`;
  }).join("");

  const xLabelTexts = xTicks.map(v => {
    const x = ((v - xFloor) / xSpan) * iW;
    if (x < -2 || x > iW + 2) return "";
    return `<text x="${x.toFixed(1)}" y="${(iH + 14).toFixed(1)}" style="fill:var(--label)" font-size="8" text-anchor="middle" font-family="ui-monospace,monospace">${fmtTick(v)}</text>`;
  }).join("");

  return `<g transform="translate(${lp},${tp})">${xGridLines}${bars}${yLabelTexts}${xLabelTexts}</g>`;
}

function renderDoughnutChart(rawData: { x: any; y: any }[], colors: string[]): string {
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

  const W = 800, H = 320;
  const cx = W / 2, cy = H / 2;
  const R = Math.min(cx, cy) - 45;
  const innerR = R * 0.5;

  let slices = "", labels = "";
  let angle = -Math.PI / 2;

  for (let i = 0; i < entries.length; i++) {
    const [name, value] = entries[i];
    const sweep = (value / total) * 2 * Math.PI;
    const endAngle = angle + sweep;
    const c = colors[i % colors.length];
    const large = sweep > Math.PI ? 1 : 0;

    const x1o = cx + R * Math.cos(angle), y1o = cy + R * Math.sin(angle);
    const x2o = cx + R * Math.cos(endAngle), y2o = cy + R * Math.sin(endAngle);
    const x1i = cx + innerR * Math.cos(endAngle), y1i = cy + innerR * Math.sin(endAngle);
    const x2i = cx + innerR * Math.cos(angle), y2i = cy + innerR * Math.sin(angle);

    slices += `<path d="M${x1o.toFixed(2)},${y1o.toFixed(2)} A${R},${R} 0 ${large},1 ${x2o.toFixed(2)},${y2o.toFixed(2)} L${x1i.toFixed(2)},${y1i.toFixed(2)} A${innerR},${innerR} 0 ${large},0 ${x2i.toFixed(2)},${y2i.toFixed(2)} Z" fill="${c}" style="stroke:var(--bg);stroke-width:2;"/>`;

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

  const fmtTotal = fmtTick(total);
  const center = `<text x="${cx}" y="${(cy - 6).toFixed(1)}" style="fill:var(--label)" font-size="22" font-weight="700" text-anchor="middle" font-family="ui-monospace,monospace">${fmtTotal}</text><text x="${cx}" y="${(cy + 14).toFixed(1)}" style="fill:var(--label)" font-size="10" text-anchor="middle" font-family="ui-monospace,monospace">Total</text>`;

  return `<g>${slices}${labels}${center}</g>`;
}

function renderRadarChart(rawData: { x: any; y: any }[], color: string): string {
  const agg: Record<string, number> = {};
  for (const d of rawData) {
    const key = String(d.x);
    agg[key] = (agg[key] || 0) + (Number(d.y) || 0);
  }
  const entries = Object.entries(agg).slice(0, 8);
  const n = entries.length;
  if (n < 3)
    return `<text style="fill:var(--label)" x="50%" y="50%" text-anchor="middle" font-size="13">Radar needs ≥ 3 categories</text>`;

  const W = 800, H = 320;
  const cx = W / 2, cy = H / 2;
  const R = Math.min(cx, cy) - 50;
  const maxVal = Math.max(...entries.map(([, v]) => v), 1);

  const levels = 4;
  const gridPolygons = Array.from({ length: levels }, (_, l) => {
    const r = R * ((l + 1) / levels);
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (i * 2 * Math.PI / n) - Math.PI / 2;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
    return `<polygon points="${pts}" fill="none" style="stroke:var(--grid)" stroke-width="1"/>`;
  }).join("");

  const axes = Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI / n) - Math.PI / 2;
    return `<line x1="${cx}" y1="${cy}" x2="${(cx + R * Math.cos(a)).toFixed(1)}" y2="${(cy + R * Math.sin(a)).toFixed(1)}" style="stroke:var(--grid)" stroke-width="1"/>`;
  }).join("");

  const axisLabels = entries.map(([name], i) => {
    const a = (i * 2 * Math.PI / n) - Math.PI / 2;
    const lx = cx + (R + 22) * Math.cos(a);
    const ly = cy + (R + 22) * Math.sin(a);
    const label = name.length > 12 ? name.slice(0, 11) + "…" : name;
    const anchor = Math.cos(a) > 0.1 ? "start" : Math.cos(a) < -0.1 ? "end" : "middle";
    return `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" style="fill:var(--label)" font-size="11" text-anchor="${anchor}" font-family="ui-monospace,monospace">${label}</text>`;
  }).join("");

  const pts = entries.map(([, v], i) => {
    const a = (i * 2 * Math.PI / n) - Math.PI / 2;
    const r = R * (v / maxVal);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

  const dots = entries.map(([, v], i) => {
    const a = (i * 2 * Math.PI / n) - Math.PI / 2;
    const r = R * (v / maxVal);
    return `<circle cx="${(cx + r * Math.cos(a)).toFixed(1)}" cy="${(cy + r * Math.sin(a)).toFixed(1)}" r="4" fill="${color}" fill-opacity="0.8"/>`;
  }).join("");

  return `<g>${gridPolygons}${axes}<polygon points="${pts}" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>${dots}${axisLabels}</g>`;
}

function renderKPIChart(rawData: { x: any; y: any }[], color: string): string {
  if (rawData.length === 0)
    return `<text style="fill:var(--label)" x="50%" y="50%" text-anchor="middle" font-size="13">No data</text>`;

  const total = rawData.reduce((s, d) => s + (Number(d.y) || 0), 0);
  const fmtVal = fmtTick(total);
  const count = rawData.length;
  const W = 800, H = 320;

  return `<text x="${W / 2}" y="${H / 2 - 18}" text-anchor="middle" style="fill:${color}" font-size="80" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,ui-sans-serif,sans-serif">${fmtVal}</text><text x="${W / 2}" y="${H / 2 + 26}" text-anchor="middle" style="fill:var(--label)" font-size="13" font-family="ui-monospace,monospace">${count} records</text>`;
}

export function getViewBox(_chartType: ChartType): string {
  return "0 0 800 320";
}

export const DEFAULT_MULTI_COLORS = [
  "#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#a855f7",
];

export function renderSvgChart(
  rawData: any[],
  color: string,
  chartType: ChartType = "line",
  colors?: string[],
  yFields?: string[],
  startingPoint?: number | "auto",
): string {
  const resolvedColors = colors && colors.length > 0 ? colors : [color];
  if (yFields && yFields.length > 1) {
    const multi = rawData as Record<string, any>[];
    if (chartType === "bar" || chartType === "hbar") return renderMultiSeriesBarChart(multi, yFields, resolvedColors, startingPoint);
    if (chartType === "pie" || chartType === "doughnut") return renderPieChart(multi.map(d => ({ x: d.x, y: d[yFields[0]] })), resolvedColors);
    if (chartType === "kpi") return renderKPIChart(multi.map(d => ({ x: d.x, y: d[yFields[0]] })), color);
    if (chartType === "radar") return renderRadarChart(multi.map(d => ({ x: d.x, y: d[yFields[0]] })), color);
    return renderMultiSeriesLineChart(multi, yFields, resolvedColors, startingPoint);
  }
  const single: { x: any; y: any }[] = (yFields && yFields.length === 1)
    ? rawData.map(d => ({ x: d.x, y: d[yFields[0]] }))
    : rawData as { x: any; y: any }[];
  if (chartType === "bar") return renderBarChart(single, resolvedColors, startingPoint);
  if (chartType === "hbar") return renderHBarChart(single, resolvedColors, startingPoint);
  if (chartType === "pie") return renderPieChart(single, resolvedColors);
  if (chartType === "doughnut") return renderDoughnutChart(single, resolvedColors);
  if (chartType === "radar") return renderRadarChart(single, resolvedColors[0]);
  if (chartType === "kpi") return renderKPIChart(single, color);
  return renderLineChart(single, resolvedColors[0], startingPoint);
}
