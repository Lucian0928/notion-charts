export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr).slice(0, 10);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}

export function renderSvgChart(rawData: { x: any; y: any }[], color: string): string {
  // Always sort ascending by X so oldest→newest left→right
  const data = [...rawData].sort((a, b) =>
    String(a.x) < String(b.x) ? -1 : String(a.x) > String(b.x) ? 1 : 0
  );

  const W = 800;
  const H = 320;
  const pad = { top: 14, right: 12, bottom: 52, left: 34 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  if (data.length === 0)
    return `<text style="fill:var(--label)" x="50%" y="50%" text-anchor="middle" font-size="13">No data</text>`;

  const ys = data.map((d) => Number(d.y));
  const maxY = Math.max(...ys);
  const yMax = Math.ceil(maxY * 10) / 10;
  const yRange = yMax || 1;

  const sx = (i: number) => (i / (data.length - 1)) * iW;
  const sy = (v: number) => iH - (v / yRange) * iH;

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(Number(d.y)).toFixed(1)}`)
    .join(" ");

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
    const label = formatDateLabel(String(data[i].x));
    return `<text transform="translate(${x.toFixed(1)},${iH + 12}) rotate(-45)" style="fill:var(--label)" font-size="8.5" text-anchor="end" font-family="ui-monospace,monospace">${label}</text>`;
  }).join("");

  const tickStep = 0.1;
  const yTickValues: number[] = [];
  for (let v = 0; v <= yMax + 0.001; v = Math.round((v + tickStep) * 100) / 100) yTickValues.push(v);

  const yGridLines = yTickValues.map((v) => {
    const y = sy(v);
    if (y < -2 || y > iH + 2) return "";
    return `<line x1="0" y1="${y.toFixed(1)}" x2="${iW}" y2="${y.toFixed(1)}" style="stroke:var(--grid)" stroke-width="1"/>`;
  }).join("");

  const yLabelTexts = yTickValues.map((v) => {
    const y = sy(v);
    if (y < -2 || y > iH + 2) return "";
    return `<text x="-6" y="${(y + 3).toFixed(1)}" style="fill:var(--label)" font-size="8.5" text-anchor="end" font-family="ui-monospace,monospace">${v.toFixed(1)}</text>`;
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
