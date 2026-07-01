import type { ChartType } from "./types";

const ANIM_CSS = `<style>
.chart-bar{transform-box:fill-box;transform-origin:50% 100%;animation:chartBarGrow 0.45s cubic-bezier(0.22,1,0.36,1) both}
.chart-hbar{transform-box:fill-box;transform-origin:0% 50%;animation:chartHBarGrow 0.45s cubic-bezier(0.22,1,0.36,1) both}
.chart-sector{transform-box:view-box;transform-origin:50% 50%;animation:chartSectorEnter 0.4s cubic-bezier(0.22,1,0.36,1) both}
.chart-line{animation:chartLineDraw 1.2s cubic-bezier(0.4,0,0.2,1) both}
.chart-fill{animation:chartFillFade 0.8s ease-out 0.4s both}
@keyframes chartBarGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes chartHBarGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes chartSectorEnter{from{opacity:0;transform:scale(0.75)}to{opacity:1;transform:scale(1)}}
@keyframes chartLineDraw{to{stroke-dashoffset:0}}
@keyframes chartFillFade{from{opacity:0}to{opacity:1}}
</style>`;

function polylineLen(pts: [number, number][]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len * 1.1; // 10% buffer for smooth-curve overshoot
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const day = String(d.getDate()).padStart(2, "0");
  return `${months[d.getMonth()]} ${day},${String(d.getFullYear()).slice(2)}`;
}

// Catmull-Rom spline → cubic bezier SVG path (Y control points clamped to prevent overshoot)
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
    let cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    let cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    const lo = Math.min(p1[1], p2[1]);
    const hi = Math.max(p1[1], p2[1]);
    cp1y = Math.max(lo, Math.min(hi, cp1y));
    cp2y = Math.max(lo, Math.min(hi, cp2y));
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
  if (typeof sp === "number") return sp;
  const validYs = ys.filter(v => !isNaN(v));
  const minVal = validYs.length ? Math.min(...validYs) : 0;
  if (minVal < 0) {
    const rough = minVal * 1.1;
    const mag = Math.pow(10, Math.floor(Math.log10(Math.max(Math.abs(rough), 1e-10))));
    return Math.floor(rough / mag) * mag;
  }
  return 0;
}

function smartTicksFrom(minY: number, maxY: number): number[] {
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
  const abs = Math.abs(v), sign = v < 0 ? "-" : "";
  if (abs >= 1000000) return sign + (abs / 1000000).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (abs >= 1000) return sign + (abs / 1000).toFixed(2).replace(/\.?0+$/, "") + "k";
  if (Number.isInteger(v)) return String(v);
  const r = Math.round(v * 100) / 100;
  return r % 1 === 0 ? String(r) : r.toFixed(Math.abs(r) < 0.01 ? 3 : 2).replace(/\.?0+$/, "");
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
  const rotateX = maxLabelLen * (F * 0.6) > labelSpacing * 0.65;
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

  const zeroY = Math.min(iH - ((0 - yFloor) / ySpan) * iH, iH);
  const pts: [number, number][] = data.map((d, i) => [sx(i), sy(Number(d.y))]);
  const linePath = smoothLinePath(pts);
  const areaPath = `${linePath} L${sx(data.length - 1).toFixed(1)},${zeroY.toFixed(1)} L${sx(0).toFixed(1)},${zeroY.toFixed(1)} Z`;
  const lineLen = Math.round(polylineLen(pts));

  const dots = data.length <= 200
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

  const xLabelTexts = sortedIndices.map((i, pos) => {
    const x = sx(i);
    const label = xLabels[i];
    if (rotateX) {
      return `<text transform="translate(${x.toFixed(1)},${iH + xF}) rotate(-45)" style="fill:var(--label)" font-size="${xF}" text-anchor="end" font-family="ui-monospace,monospace">${label}</text>`;
    }
    const anchor = pos === 0 ? "start" : pos === sortedIndices.length - 1 ? "end" : "middle";
    return `<text x="${x.toFixed(1)}" y="${(iH + F + 4).toFixed(1)}" style="fill:var(--label)" font-size="${F}" text-anchor="${anchor}" font-family="ui-monospace,monospace">${label}</text>`;
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

  return ANIM_CSS + `
    <g transform="translate(${pad.left},${pad.top})">
      ${yGridLines}
      ${xGridLines}
      <path d="${areaPath}" fill="${color}" fill-opacity="0.18" class="chart-fill"/>
      <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" class="chart-line" style="stroke-dasharray:${lineLen};stroke-dashoffset:${lineLen}"/>
      ${dots}
      ${xLabelTexts}
      ${yLabelTexts}
    </g>`;
}

function renderBarChart(rawData: { x: any; y: any }[], colors: string[], startingPoint?: number | "auto", prefix = ""): string {
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
  const pad = { top: 14, right: rp2, bottom: rotateX ? Math.ceil(maxLabelLen * xF2 * 0.65 * 0.707) + 8 : F2 + 24, left: lp2 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  const ys = data.map((d) => Number(d.y));
  const maxY = Math.max(...ys);
  const yFloor = resolveMinY(ys, startingPoint);
  const yTicks = smartTicksFrom(yFloor, maxY);
  const yCeil = yTicks[yTicks.length - 1] || 1;
  const ySpan = yCeil - yFloor || 1;

  const slotW = iW / n;
  const barPad = Math.min(slotW * 0.1, 6);
  const barW = Math.max(1, slotW - barPad * 2);
  const rx = Math.min(8, barW * 0.15);

  const sy = (v: number) => iH - ((v - yFloor) / ySpan) * iH;

  const zeroY = iH - ((0 - yFloor) / ySpan) * iH;
  const effectiveZeroY = Math.min(zeroY, iH); // clamp bars to chart area when yFloor > 0
  const bars = data.map((d, i) => {
    const c = colors[i % colors.length];
    const bx = i * slotW + barPad;
    const v = Number(d.y);
    const valY = iH - ((v - yFloor) / ySpan) * iH;
    const by = Math.min(valY, effectiveZeroY);
    const bh = Math.max(1, Math.abs(effectiveZeroY - valY));
    return `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${c}" rx="${rx}" class="chart-bar" style="animation-delay:${i * 40}ms"/>`;
  }).join("");

  const xGridLines = Array.from({ length: n + 1 }, (_, i) => {
    const x = i * slotW;
    return `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${iH}" style="stroke:var(--grid)" stroke-width="1"/>`;
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
  const renderedBarIndices: number[] = data.reduce((acc: number[], _, i) => {
    if (i % step === 0 || i === n - 1) acc.push(i);
    return acc;
  }, []);
  const xLabelTexts = data.map((d, i) => {
    const pos = renderedBarIndices.indexOf(i);
    if (pos === -1) return "";
    const cx = i * slotW + slotW / 2;
    const label = xLabels[i];
    if (rotateX) {
      return `<text transform="translate(${cx.toFixed(1)},${iH + xF2}) rotate(-45)" style="fill:var(--label)" font-size="${xF2}" text-anchor="end" font-family="ui-monospace,monospace">${label}</text>`;
    }
    return `<text x="${cx.toFixed(1)}" y="${(iH + F2 + 14).toFixed(1)}" style="fill:var(--label)" font-size="${F2}" text-anchor="middle" font-family="ui-monospace,monospace">${label}</text>`;
  }).join("");

  return ANIM_CSS + `
    <g transform="translate(${pad.left},${pad.top})">
      ${yGridLines}
      ${xGridLines}
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
  const vp = 8;
  const R = Math.floor((H - vp * 2) / 2);
  const LW = Math.floor((W - 60 - R * 2) / 2);
  const cx = W / 2, cy = H / 2;

  // Build slices
  interface Slice { name: string; value: number; sweep: number; start: number; end: number; mid: number; color: string; pct: number }
  const sliceData: Slice[] = [];
  let angle = -Math.PI / 2;
  for (let i = 0; i < entries.length; i++) {
    const [name, value] = entries[i];
    const sweep = (value / total) * 2 * Math.PI;
    sliceData.push({ name, value, sweep, start: angle, end: angle + sweep, mid: angle + sweep / 2, color: colors[i % colors.length], pct: (value / total) * 100 });
    angle += sweep;
  }

  // Draw slices
  let slices = sliceData.map((sd, i) => {
    const x1 = cx + R * Math.cos(sd.start), y1 = cy + R * Math.sin(sd.start);
    const x2 = cx + R * Math.cos(sd.end), y2 = cy + R * Math.sin(sd.end);
    const large = sd.sweep > Math.PI ? 1 : 0;
    return `<path d="M${cx.toFixed(1)},${cy.toFixed(1)} L${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${sd.color}" class="chart-sector" style="stroke:var(--bg);stroke-width:1.5;animation-delay:${i * 80}ms"/>`;
  }).join("");

  // Legend-swatch labels in left/right columns (no connector lines)
  const leftG = sliceData.filter(s => Math.cos(s.mid) < 0).sort((a, b) => Math.sin(a.mid) - Math.sin(b.mid));
  const rightG = sliceData.filter(s => Math.cos(s.mid) >= 0).sort((a, b) => Math.sin(a.mid) - Math.sin(b.mid));
  const fSz = 11, rowH = fSz + 9, swW = 22, swH = 9;

  function placeY(grp: Slice[]): { s: Slice; y: number }[] {
    const n = grp.length, tot = n * rowH;
    const items = grp.map((s, i) => ({ s, y: cy - tot / 2 + (i + 0.5) * rowH }));
    for (let it = 0; it < 30; it++) {
      for (let j = 0; j < items.length - 1; j++) {
        const g = items[j + 1].y - items[j].y;
        if (g < rowH) { const p = (rowH - g) / 2; items[j].y -= p; items[j + 1].y += p; }
      }
    }
    items.forEach(item => { item.y = Math.max(vp + fSz, Math.min(H - vp - fSz, item.y)); });
    return items;
  }

  const leftItems = placeY(leftG), rightItems = placeY(rightG);
  let labels = "";

  leftItems.forEach(({ s, y: ly }) => {
    const sx = LW - swW;
    const nm = s.name.length > 22 ? s.name.slice(0, 21) + "…" : s.name;
    labels += `<rect x="${sx}" y="${(ly - swH / 2).toFixed(1)}" width="${swW}" height="${swH}" rx="2" fill="${s.color}"/>`;
    labels += `<text x="${sx - 7}" y="${(ly + fSz * 0.36).toFixed(1)}" style="fill:var(--label)" font-size="${fSz}" text-anchor="end" font-family="ui-monospace,monospace">${nm}  ${s.pct.toFixed(2).replace(/\.?0+$/, "")}%</text>`;
  });

  rightItems.forEach(({ s, y: ly }) => {
    const col = W - LW;
    const nm = s.name.length > 22 ? s.name.slice(0, 21) + "…" : s.name;
    labels += `<rect x="${col}" y="${(ly - swH / 2).toFixed(1)}" width="${swW}" height="${swH}" rx="2" fill="${s.color}"/>`;
    labels += `<text x="${col + swW + 8}" y="${(ly + fSz * 0.36).toFixed(1)}" style="fill:var(--label)" font-size="${fSz}" text-anchor="start" font-family="ui-monospace,monospace">${nm}  ${s.pct.toFixed(2).replace(/\.?0+$/, "")}%</text>`;
  });

  return ANIM_CSS + `<g>${slices}${labels}</g>`;
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
  const rotateX = maxLabelLen * (F * 0.6) > labelSpacing * 0.65;
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
  const xLabelTexts = sortedIndices.map((i, pos) => {
    const x = sx(i);
    if (rotateX)
      return `<text transform="translate(${x.toFixed(1)},${iH + xF}) rotate(-45)" style="fill:var(--label)" font-size="${xF}" text-anchor="end" font-family="ui-monospace,monospace">${xLabels[i]}</text>`;
    const anchor = pos === 0 ? "start" : pos === sortedIndices.length - 1 ? "end" : "middle";
    return `<text x="${x.toFixed(1)}" y="${(iH + F + 4).toFixed(1)}" style="fill:var(--label)" font-size="${F}" text-anchor="${anchor}" font-family="ui-monospace,monospace">${xLabels[i]}</text>`;
  }).join("");
  const yGridLines = yTicks.map((v) => {
    const y = sy(v); if (y < -2 || y > iH + 2) return "";
    return `<line x1="0" y1="${y.toFixed(1)}" x2="${iW}" y2="${y.toFixed(1)}" style="stroke:var(--grid)" stroke-width="1"/>`;
  }).join("");
  const yLabelTexts = yTicks.map((v) => {
    const y = sy(v); if (y < -2 || y > iH + 2) return "";
    return `<text x="-6" y="${(y + 3).toFixed(1)}" style="fill:var(--label)" font-size="8.5" text-anchor="end" font-family="ui-monospace,monospace">${fmtTick(v)}</text>`;
  }).join("");

  const zeroY = Math.min(iH - ((0 - yFloor) / ySpan) * iH, iH);
  const seriesSvg = yFields.map((yf, si) => {
    const c = colors[si % colors.length];
    const pts: [number, number][] = data.map((d, i) => [sx(i), sy(Number(d[yf]) || 0)]);
    const linePath = smoothLinePath(pts);
    const areaPath = `${linePath} L${sx(data.length - 1).toFixed(1)},${zeroY.toFixed(1)} L${sx(0).toFixed(1)},${zeroY.toFixed(1)} Z`;
    const lineLen = Math.round(polylineLen(pts));
    const delay = si * 300;
    const dots = data.length <= 200
      ? data.map((d, i) =>
          `<circle cx="${sx(i).toFixed(1)}" cy="${sy(Number(d[yf]) || 0).toFixed(1)}" r="4" fill="var(--bg)" stroke="${c}" stroke-width="1.8"/>`
        ).join("")
      : "";
    return `<path d="${areaPath}" fill="${c}" fill-opacity="${yFields.length > 1 ? 0.08 : 0.18}" class="chart-fill" style="animation-delay:${delay + 400}ms"/>
<path d="${linePath}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round" class="chart-line" style="stroke-dasharray:${lineLen};stroke-dashoffset:${lineLen};animation-delay:${delay}ms"/>${dots}`;
  }).join("");

  const legend = yFields.map((yf, si) => {
    const c = colors[si % colors.length];
    const label = yf.length > 14 ? yf.slice(0, 13) + "…" : yf;
    return `<g transform="translate(${si * (iW / yFields.length)},${-10})">
      <circle cx="6" cy="0" r="3.5" fill="${c}"/>
      <text x="13" y="3.5" style="fill:var(--label)" font-size="8" font-family="ui-monospace,monospace">${label}</text>
    </g>`;
  }).join("");

  return ANIM_CSS + `<g transform="translate(${pad.left},${pad.top})">${yGridLines}${xGridLines}${seriesSvg}${xLabelTexts}${yLabelTexts}${legend}</g>`;
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

  const zeroYM = iH - ((0 - yFloor) / ySpan) * iH;
  const bars = data.map((d, i) => {
    const gx = i * slotW + groupPad;
    return yFields.map((yf, si) => {
      const c = colors[si % colors.length];
      const bx = gx + si * (barW + barGap);
      const val = Number(d[yf]) || 0;
      const valY = iH - ((val - yFloor) / ySpan) * iH;
      const by = Math.min(valY, zeroYM);
      const bh = Math.max(1, Math.abs(zeroYM - valY));
      return `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${c}" fill-opacity="0.85" rx="${rx}" class="chart-bar" style="animation-delay:${(i * nS + si) * 25}ms"/>`;
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
  const renderedMBarIndices: number[] = data.reduce((acc: number[], _, i) => {
    if (i % stepX === 0 || i === n - 1) acc.push(i);
    return acc;
  }, []);
  const xLabelTexts = data.map((d, i) => {
    const pos = renderedMBarIndices.indexOf(i);
    if (pos === -1) return "";
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

  const xGridLines = Array.from({ length: n + 1 }, (_, i) => {
    const x = i * slotW;
    return `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${iH}" style="stroke:var(--grid)" stroke-width="1"/>`;
  }).join("");
  return ANIM_CSS + `<g transform="translate(${pad.left},${pad.top})">${yGridLines}${xGridLines}${bars}${xLabelTexts}${yLabelTexts}${legend}</g>`;
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

  const zeroX = ((0 - xFloor) / xSpan) * iW;
  const bars = data.map((d, i) => {
    const c = colors[i % colors.length];
    const by = i * slotH + barPad;
    const valX = ((Number(d.y) - xFloor) / xSpan) * iW;
    const bx = Math.min(valX, zeroX);
    const bw = Math.max(1, Math.abs(valX - zeroX));
    return `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${barH.toFixed(1)}" fill="${c}" fill-opacity="0.85" rx="${rx}" class="chart-hbar" style="animation-delay:${i * 40}ms"/>`;
  }).join("");

  const maxLabels = Math.max(2, Math.floor(iH / 20));
  const labelStep = Math.max(1, Math.ceil(n / maxLabels));
  const yLabelTexts = data.map((d, i) => {
    if (i % labelStep !== 0 && i !== n - 1) return "";
    const cy2 = i * slotH + slotH / 2;
    const label = String(d.x).length > 12 ? String(d.x).slice(0, 11) + "…" : String(d.x);
    return `<text x="-6" y="${(cy2 + 3.5).toFixed(1)}" style="fill:var(--label)" font-size="8" text-anchor="end" font-family="ui-monospace,monospace">${label}</text>`;
  }).join("");

  // Vertical grid lines: left edge, tick positions, right edge
  const xGridLines = [
    `<line x1="0" y1="0" x2="0" y2="${iH}" style="stroke:var(--grid)" stroke-width="1"/>`,
    ...xTicks.map(v => {
      const x = ((v - xFloor) / xSpan) * iW;
      if (x < -2 || x > iW + 2) return "";
      return `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${iH}" style="stroke:var(--grid)" stroke-width="1"/>`;
    }),
    `<line x1="${iW}" y1="0" x2="${iW}" y2="${iH}" style="stroke:var(--grid)" stroke-width="1"/>`,
  ].join("");

  const yGridLines = Array.from({ length: n + 1 }, (_, i) => {
    const y = i * slotH;
    return `<line x1="0" y1="${y.toFixed(1)}" x2="${iW}" y2="${y.toFixed(1)}" style="stroke:var(--grid)" stroke-width="1"/>`;
  }).join("");

  const xLabelTexts = xTicks.map(v => {
    const x = ((v - xFloor) / xSpan) * iW;
    if (x < -2 || x > iW + 2) return "";
    return `<text x="${x.toFixed(1)}" y="${(iH + 14).toFixed(1)}" style="fill:var(--label)" font-size="8" text-anchor="middle" font-family="ui-monospace,monospace">${fmtTick(v)}</text>`;
  }).join("");

  return ANIM_CSS + `<g transform="translate(${lp},${tp})">${yGridLines}${xGridLines}${bars}${yLabelTexts}${xLabelTexts}</g>`;
}

function fmtCurrency(v: number, prefix: string): string {
  const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return (v < 0 ? "-" : "") + prefix + s;
}

function renderDoughnutChart(rawData: { x: any; y: any }[], colors: string[], prefix = ""): string {
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
  const vp = 8;
  const R = Math.floor((H - vp * 2) / 2);
  const LW = Math.floor((W - 60 - R * 2) / 2);
  const innerR = Math.round(R * 0.5);
  const cx = W / 2, cy = H / 2;

  interface Slice { name: string; value: number; sweep: number; start: number; end: number; mid: number; color: string; pct: number }
  const sliceData: Slice[] = [];
  let angle = -Math.PI / 2;
  for (let i = 0; i < entries.length; i++) {
    const [name, value] = entries[i];
    const sweep = (value / total) * 2 * Math.PI;
    sliceData.push({ name, value, sweep, start: angle, end: angle + sweep, mid: angle + sweep / 2, color: colors[i % colors.length], pct: (value / total) * 100 });
    angle += sweep;
  }

  // Draw slices (no stroke)
  let slices = sliceData.map((sd, i) => {
    const x1o = cx + R * Math.cos(sd.start), y1o = cy + R * Math.sin(sd.start);
    const x2o = cx + R * Math.cos(sd.end), y2o = cy + R * Math.sin(sd.end);
    const x1i = cx + innerR * Math.cos(sd.end), y1i = cy + innerR * Math.sin(sd.end);
    const x2i = cx + innerR * Math.cos(sd.start), y2i = cy + innerR * Math.sin(sd.start);
    const large = sd.sweep > Math.PI ? 1 : 0;
    return `<path d="M${x1o.toFixed(2)},${y1o.toFixed(2)} A${R},${R} 0 ${large},1 ${x2o.toFixed(2)},${y2o.toFixed(2)} L${x1i.toFixed(2)},${y1i.toFixed(2)} A${innerR},${innerR} 0 ${large},0 ${x2i.toFixed(2)},${y2i.toFixed(2)} Z" fill="${sd.color}" class="chart-sector" style="animation-delay:${i * 80}ms"/>`;
  }).join("");

  // Center total text — scales with inner circle radius
  const fmtTotal = fmtCurrency(total, prefix);
  const bigF = Math.max(9, Math.round(innerR * 1.8 / Math.max(fmtTotal.length, 4)));
  const smF = Math.max(7, Math.round(bigF * 0.55));
  const cy1 = cy + bigF * 0.35 - (smF + 4) / 2;
  const cy2 = cy + bigF * 0.35 + (bigF * 0.15 + 4 + smF * 0.85) - (smF + 4) / 2;
  slices += `<text x="${cx}" y="${cy1.toFixed(1)}" style="fill:var(--label)" font-size="${bigF}" font-weight="700" text-anchor="middle" font-family="ui-monospace,monospace">${fmtTotal}</text><text x="${cx}" y="${cy2.toFixed(1)}" style="fill:var(--label)" font-size="${smF}" text-anchor="middle" font-family="ui-monospace,monospace">Total</text>`;

  // Legend-swatch labels in left/right columns (same as pie)
  const leftG = sliceData.filter(s => Math.cos(s.mid) < 0).sort((a, b) => Math.sin(a.mid) - Math.sin(b.mid));
  const rightG = sliceData.filter(s => Math.cos(s.mid) >= 0).sort((a, b) => Math.sin(a.mid) - Math.sin(b.mid));
  const fSz = 11, rowH = fSz + 9, swW = 22, swH = 9;

  function placeY(grp: Slice[]): { s: Slice; y: number }[] {
    const n = grp.length, tot = n * rowH;
    const items = grp.map((s, i) => ({ s, y: cy - tot / 2 + (i + 0.5) * rowH }));
    for (let it = 0; it < 30; it++) {
      for (let j = 0; j < items.length - 1; j++) {
        const g = items[j + 1].y - items[j].y;
        if (g < rowH) { const p = (rowH - g) / 2; items[j].y -= p; items[j + 1].y += p; }
      }
    }
    items.forEach(item => { item.y = Math.max(vp + fSz, Math.min(H - vp - fSz, item.y)); });
    return items;
  }

  const leftItems = placeY(leftG), rightItems = placeY(rightG);
  let labels = "";

  leftItems.forEach(({ s, y: ly }) => {
    const sx = LW - swW;
    const nm = s.name.length > 22 ? s.name.slice(0, 21) + "…" : s.name;
    labels += `<rect x="${sx}" y="${(ly - swH / 2).toFixed(1)}" width="${swW}" height="${swH}" rx="2" fill="${s.color}"/>`;
    labels += `<text x="${sx - 7}" y="${(ly + fSz * 0.36).toFixed(1)}" style="fill:var(--label)" font-size="${fSz}" text-anchor="end" font-family="ui-monospace,monospace">${nm}  ${s.pct.toFixed(2).replace(/\.?0+$/, "")}%</text>`;
  });

  rightItems.forEach(({ s, y: ly }) => {
    const col = W - LW;
    const nm = s.name.length > 22 ? s.name.slice(0, 21) + "…" : s.name;
    labels += `<rect x="${col}" y="${(ly - swH / 2).toFixed(1)}" width="${swW}" height="${swH}" rx="2" fill="${s.color}"/>`;
    labels += `<text x="${col + swW + 8}" y="${(ly + fSz * 0.36).toFixed(1)}" style="fill:var(--label)" font-size="${fSz}" text-anchor="start" font-family="ui-monospace,monospace">${nm}  ${s.pct.toFixed(2).replace(/\.?0+$/, "")}%</text>`;
  });

  return ANIM_CSS + `<g>${slices}${labels}</g>`;
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

  const W = 620, H = 500;
  const cx = W / 2, cy = H / 2;
  const R = Math.min(cx, cy) - 80;
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
    const label = name.length > 20 ? name.slice(0, 19) + "…" : name;
    const anchor = Math.cos(a) > 0.1 ? "start" : Math.cos(a) < -0.1 ? "end" : "middle";
    return `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" style="fill:var(--label)" font-size="11" text-anchor="${anchor}" font-family="ui-monospace,monospace">${label}</text>`;
  }).join("");

  const centerPts = Array.from({ length: n }, () => `${cx.toFixed(1)},${cy.toFixed(1)}`).join(" ");
  const finalPts = entries.map(([, v], i) => {
    const a = (i * 2 * Math.PI / n) - Math.PI / 2;
    const r = R * (v / maxVal);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  const anim = `calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" dur="0.6s" begin="0s" fill="freeze"`;

  const polygon = `<polygon points="${centerPts}" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2" stroke-linejoin="round"><animate attributeName="points" from="${centerPts}" to="${finalPts}" ${anim}/></polygon>`;

  const dots = entries.map(([, v], i) => {
    const a = (i * 2 * Math.PI / n) - Math.PI / 2;
    const r = R * (v / maxVal);
    const dx = (cx + r * Math.cos(a)).toFixed(1), dy = (cy + r * Math.sin(a)).toFixed(1);
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4" fill="${color}" fill-opacity="0.8"><animate attributeName="cx" from="${cx.toFixed(1)}" to="${dx}" ${anim}/><animate attributeName="cy" from="${cy.toFixed(1)}" to="${dy}" ${anim}/></circle>`;
  }).join("");

  return ANIM_CSS + `<g>${gridPolygons}${axes}${polygon}${dots}${axisLabels}</g>`;
}

function renderMultiSeriesRadarChart(
  rawData: Record<string, any>[],
  yFields: string[],
  colors: string[],
): string {
  const catOrder: string[] = [];
  const catSet = new Set<string>();
  rawData.forEach(d => { const k = String(d.x); if (!catSet.has(k)) { catSet.add(k); catOrder.push(k); } });
  const categories = catOrder.slice(0, 8);
  const n = categories.length;
  if (n < 3)
    return `<text style="fill:var(--label)" x="50%" y="50%" text-anchor="middle" font-size="13">Radar needs ≥ 3 categories</text>`;

  const seriesAgg = yFields.map(yf => {
    const agg: Record<string, number> = {};
    rawData.forEach(d => { const k = String(d.x); agg[k] = (agg[k] || 0) + (Number(d[yf]) || 0); });
    return categories.map(c => agg[c] || 0);
  });
  const maxVal = Math.max(...seriesAgg.flat(), 1);

  const W = 620, H = 500, cx = W / 2, cy = H / 2, R = Math.min(cx, cy) - 80;

  const gridPolygons = Array.from({ length: 4 }, (_, l) => {
    const r = R * ((l + 1) / 4);
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

  const axisLabels = categories.map((name, i) => {
    const a = (i * 2 * Math.PI / n) - Math.PI / 2;
    const label = name.length > 20 ? name.slice(0, 19) + "…" : name;
    const anchor = Math.cos(a) > 0.1 ? "start" : Math.cos(a) < -0.1 ? "end" : "middle";
    return `<text x="${(cx + (R + 22) * Math.cos(a)).toFixed(1)}" y="${(cy + (R + 22) * Math.sin(a) + 4).toFixed(1)}" style="fill:var(--label)" font-size="11" text-anchor="${anchor}" font-family="ui-monospace,monospace">${label}</text>`;
  }).join("");

  const centerPts = Array.from({ length: n }, () => `${cx.toFixed(1)},${cy.toFixed(1)}`).join(" ");
  const seriesSvg = yFields.map((yf, si) => {
    const c = colors[si % colors.length];
    const vals = seriesAgg[si];
    const finalPts = categories.map((_, i) => {
      const a = (i * 2 * Math.PI / n) - Math.PI / 2;
      const r = R * (vals[i] / maxVal);
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
    const delay = `${(si * 0.15).toFixed(2)}s`;
    const anim = `calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" dur="0.6s" begin="${delay}" fill="freeze"`;
    const polygon = `<polygon points="${centerPts}" fill="${c}" fill-opacity="0.12" stroke="${c}" stroke-width="2" stroke-linejoin="round"><animate attributeName="points" from="${centerPts}" to="${finalPts}" ${anim}/></polygon>`;
    const dots = categories.map((_, i) => {
      const a = (i * 2 * Math.PI / n) - Math.PI / 2;
      const r = R * (vals[i] / maxVal);
      const dx = (cx + r * Math.cos(a)).toFixed(1), dy = (cy + r * Math.sin(a)).toFixed(1);
      return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4" fill="${c}" fill-opacity="0.8"><animate attributeName="cx" from="${cx.toFixed(1)}" to="${dx}" ${anim}/><animate attributeName="cy" from="${cy.toFixed(1)}" to="${dy}" ${anim}/></circle>`;
    }).join("");
    return `<g>${polygon}${dots}</g>`;
  }).join("");

  const legendGap = 16;
  const legendLabels = yFields.map(yf => yf.length > 16 ? yf.slice(0, 15) + "…" : yf);
  const legendItemWidths = legendLabels.map(lbl => 12 + lbl.length * 5.5);
  const legendTotalW = legendItemWidths.reduce((a, b) => a + b, 0) + (yFields.length - 1) * legendGap;
  let legendCurX = cx - legendTotalW / 2;
  const legend = yFields.map((yf, si) => {
    const c = colors[si % colors.length];
    const lx = legendCurX;
    legendCurX += legendItemWidths[si] + legendGap;
    return `<g transform="translate(${lx.toFixed(0)},${H - 18})"><circle cx="4" cy="0" r="3.5" fill="${c}"/><text x="12" y="3.5" style="fill:var(--label)" font-size="9" font-family="ui-monospace,monospace">${legendLabels[si]}</text></g>`;
  }).join("");

  return ANIM_CSS + `<g>${gridPolygons}${axes}${seriesSvg}${axisLabels}${legend}</g>`;
}


export function getViewBox(chartType: ChartType): string {
  if (chartType === "radar") return "0 0 620 500";
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
  prefix = "",
): string {
  const resolvedColors = colors && colors.length > 0 ? colors : [color];
  if (yFields && yFields.length > 1) {
    const multi = rawData as Record<string, any>[];
    if (chartType === "bar" || chartType === "hbar") return renderMultiSeriesBarChart(multi, yFields, resolvedColors, startingPoint);
    if (chartType === "pie" || chartType === "doughnut") return renderPieChart(multi.map(d => ({ x: d.x, y: d[yFields[0]] })), resolvedColors);
    if (chartType === "radar") return renderMultiSeriesRadarChart(multi, yFields, resolvedColors);
    return renderMultiSeriesLineChart(multi, yFields, resolvedColors, startingPoint);
  }
  const single: { x: any; y: any }[] = (yFields && yFields.length === 1)
    ? rawData.map(d => ({ x: d.x, y: d[yFields[0]] }))
    : rawData as { x: any; y: any }[];
  if (chartType === "bar") return renderBarChart(single, resolvedColors, startingPoint, prefix);
  if (chartType === "hbar") return renderHBarChart(single, resolvedColors, startingPoint);
  if (chartType === "pie") return renderPieChart(single, resolvedColors);
  if (chartType === "doughnut") return renderDoughnutChart(single, resolvedColors, prefix);
  if (chartType === "radar") return renderRadarChart(single, resolvedColors[0]);
  return renderLineChart(single, resolvedColors[0], startingPoint);
}
