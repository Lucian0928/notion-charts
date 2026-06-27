export const dynamic = "force-dynamic";

import { kv } from "@vercel/kv";
import { fetchChartData } from "@/lib/notionData";
import { renderSvgChart, getViewBox } from "@/lib/chartSvg";

interface Props {
  searchParams: Promise<{
    id?: string;
    databaseId?: string;
    xField?: string;
    yField?: string;
    color?: string;
    title?: string;
    debug?: string;
  }>;
}

async function fetchData(databaseId: string, xField: string, yField: string) {
  const token = process.env.NOTION_CHARTS_TOKEN;
  if (!token) throw new Error("NOTION_CHARTS_TOKEN not set");
  return fetchChartData(token, databaseId, xField, yField);
}

const CSS = `
  :root { --bg: #191919; --grid: rgba(255,255,255,0.08); --label: #6b7280; }
  html[data-theme="light"] { --bg: #ffffff; --grid: rgba(0,0,0,0.1); --label: #9ca3af; }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: var(--bg); transition: background 0.3s; }
  .wrap { height: 100vh; position: relative; overflow: hidden; background: var(--bg); transition: background 0.3s; }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(22px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .chart-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; animation: slideUp 0.5s cubic-bezier(0.22,1,0.36,1) both; }
  .footer { position: absolute; bottom: 6px; right: 12px; font-size: 10px; color: var(--label); font-family: sans-serif; opacity: 0.5; pointer-events: none; animation: slideUp 0.5s 0.08s cubic-bezier(0.22,1,0.36,1) both; }

  /* Liquid Glass pill */
  .lg-pill {
    display: flex;
    align-items: center;
    height: 38px;
    border-radius: 999px;
    padding: 3px;
    cursor: pointer;
    user-select: none;
    touch-action: none;
    /* Glass material */
    background: rgba(120,120,128,0.28);
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    border: 1px solid rgba(255,255,255,0.22);
    box-shadow:
      0 4px 24px rgba(0,0,0,0.28),
      0 1px 0 rgba(255,255,255,0.18) inset,
      0 -1px 0 rgba(0,0,0,0.12) inset;
    transition: box-shadow 0.2s;
  }
  /* Controls wrapper (pill + refresh) — fade in on hover */
  .lg-controls {
    position: absolute;
    top: 14px;
    left: 14px;
    display: flex;
    gap: 8px;
    align-items: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s;
  }
  .wrap:hover .lg-controls {
    opacity: 1;
    pointer-events: auto;
  }
  /* Refresh circle button — same glass material */
  .lg-refresh {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: 1px solid rgba(255,255,255,0.22);
    background: rgba(120,120,128,0.28);
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    box-shadow: 0 4px 24px rgba(0,0,0,0.28), 0 1px 0 rgba(255,255,255,0.18) inset;
    color: rgba(255,255,255,0.82);
    transition: box-shadow 0.2s;
    padding: 0;
    flex-shrink: 0;
  }
  html[data-theme="light"] .lg-refresh {
    background: rgba(255,255,255,0.45);
    border-color: rgba(255,255,255,0.55);
    color: rgba(0,0,0,0.58);
    box-shadow: 0 4px 20px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.9) inset;
  }
  .lg-refresh:hover { box-shadow: 0 6px 30px rgba(0,0,0,0.34), 0 1px 0 rgba(255,255,255,0.22) inset; }
  .lg-refresh svg { display: block; }
  html[data-theme="light"] .lg-pill {
    background: rgba(255,255,255,0.45);
    border-color: rgba(255,255,255,0.55);
    box-shadow: 0 4px 20px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.9) inset, 0 -1px 0 rgba(0,0,0,0.06) inset;
  }
  .lg-pill:hover { box-shadow: 0 6px 30px rgba(0,0,0,0.34), 0 1px 0 rgba(255,255,255,0.22) inset; }

  /* Sliding inner bubble */
  .lg-bubble {
    position: absolute;
    top: 3px;
    left: 3px;
    width: calc(50% - 3px);
    height: calc(100% - 6px);
    border-radius: 999px;
    pointer-events: none;
    background: rgba(255,255,255,0.38);
    box-shadow: 0 2px 8px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.7) inset;
    transition: transform 0.42s cubic-bezier(0.34,1.56,0.64,1);
  }
  html[data-theme="light"] .lg-bubble {
    background: rgba(255,255,255,0.72);
    box-shadow: 0 2px 10px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,1) inset;
  }
  html[data-theme="dark"] .lg-bubble  { transform: translateX(0); }
  html[data-theme="light"] .lg-bubble { transform: translateX(calc(100% + 0px)); }

  /* Option buttons inside pill */
  .lg-opt {
    position: relative;
    z-index: 1;
    width: 46px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    border-radius: 999px;
    transition: opacity 0.2s;
    -webkit-tap-highlight-color: transparent;
    color: rgba(255,255,255,0.82);
  }
  html[data-theme="light"] .lg-opt { color: rgba(0,0,0,0.58); }
  .lg-opt:hover { opacity: 0.7; }
  .lg-opt svg { display: block; }
`;

const INIT_SCRIPT = `
  (function(){
    var t = localStorage.getItem('nc_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  })();
`;

const TOGGLE_SCRIPT = `
(function(){
  var html = document.documentElement;
  var bubble = document.querySelector('.lg-bubble');
  var pill   = document.querySelector('.lg-pill');
  var sunBtn = document.getElementById('sunBtn');
  var moonBtn= document.getElementById('moonBtn');

  function setTheme(t) {
    html.setAttribute('data-theme', t);
    localStorage.setItem('nc_theme', t);
  }

  sunBtn.addEventListener('click',  function(){ setTheme('light'); });
  moonBtn.addEventListener('click', function(){ setTheme('dark');  });

  // Drag support
  var startX = 0, startTheme = 'dark', dragging = false;

  function pointerStart(e) {
    dragging = true;
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    startTheme = html.getAttribute('data-theme') || 'dark';
    bubble.style.transition = 'none';
    e.preventDefault();
  }
  function pointerMove(e) {
    if (!dragging) return;
    var cx = e.touches ? e.touches[0].clientX : e.clientX;
    var dx = cx - startX;
    var halfW = pill.offsetWidth / 2;
    var base  = startTheme === 'light' ? halfW : 0;
    var pos   = Math.max(0, Math.min(halfW, base + dx));
    bubble.style.transform = 'translateX(' + pos + 'px)';
  }
  function pointerEnd(e) {
    if (!dragging) return;
    dragging = false;
    bubble.style.transition = 'transform 0.42s cubic-bezier(0.34,1.56,0.64,1)';
    var cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    var dx = cx - startX;
    var threshold = pill.offsetWidth * 0.18;
    var next = startTheme === 'dark'
      ? (dx >  threshold ? 'light' : 'dark')
      : (dx < -threshold ? 'dark'  : 'light');
    setTheme(next);
  }

  pill.addEventListener('mousedown',  pointerStart, { passive: false });
  pill.addEventListener('touchstart', pointerStart, { passive: false });
  document.addEventListener('mousemove',  pointerMove);
  document.addEventListener('touchmove',  pointerMove, { passive: false });
  document.addEventListener('mouseup',    pointerEnd);
  document.addEventListener('touchend',   pointerEnd);

  // Refresh button — spin, slide chart down, then reload → slides back up on load
  var refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', function() {
    var btn = this;
    var svg = btn.querySelector('svg');
    var chartSvg = document.querySelector('.chart-svg');
    var footer   = document.querySelector('.footer');

    // Button feedback
    btn.style.background = 'rgba(120,120,128,0.55)';
    btn.style.color = 'rgba(180,180,180,0.9)';
    btn.style.boxShadow = 'none';
    if (svg) {
      svg.style.transition = 'transform 0.5s cubic-bezier(0.4,0,0.2,1)';
      svg.style.transform = 'rotate(360deg)';
    }

    // Slide chart down before reload
    if (chartSvg) {
      chartSvg.style.animation = 'none';
      chartSvg.style.transition = 'opacity 0.32s ease, transform 0.32s cubic-bezier(0.4,0,1,1)';
      chartSvg.style.opacity = '0';
      chartSvg.style.transform = 'translateY(22px)';
    }
    if (footer) {
      footer.style.animation = 'none';
      footer.style.transition = 'opacity 0.2s ease';
      footer.style.opacity = '0';
    }

    setTimeout(function() { window.location.reload(); }, 400);
  });
})();
`;

export default async function EmbedPage({ searchParams }: Props) {
  const params = await searchParams;
  const { id, debug } = params;
  const isDebug = debug === "1";

  let databaseId = params.databaseId || "";
  let xField = params.xField || "";
  let yField = params.yField || "";
  let color = params.color || "#6366f1";
  let chartType: "line" | "bar" | "pie" = "line";
  let colorMode: "single" | "multi" = "single";
  let colors: string[] | undefined;

  let kvStatus = "skipped";

  // If ?id= is provided, fetch latest config from KV (stable embed URL)
  if (id) {
    try {
      const charts = (await kv.get<any[]>("nc_charts")) || [];
      const chart = charts.find((c: any) => c.id === id);
      if (chart) {
        kvStatus = "ok";
        if (chart.databaseId) databaseId = chart.databaseId;
        if (chart.xField) xField = chart.xField;
        if (chart.yField) yField = chart.yField;
        if (chart.color) color = chart.color;
        if (chart.chartType) chartType = chart.chartType;
        if (chart.colorMode) colorMode = chart.colorMode;
        if (chart.colors && chart.colors.length > 0) colors = chart.colors;
      } else {
        kvStatus = "not-found";
      }
    } catch (e: any) {
      kvStatus = "error: " + e.message;
      console.error("[embed] KV fetch failed:", e);
    }
  }

  let data: { x: any; y: any }[] = [];
  let errorMsg = "";

  try {
    if (!databaseId || !xField || !yField) throw new Error("Missing config params");
    data = await fetchData(databaseId, xField, yField);
  } catch (e: any) {
    errorMsg = e.message;
  }

  const svgContent = errorMsg
    ? `<text style="fill:#f87171" x="50%" y="50%" text-anchor="middle" font-size="13">${errorMsg}</text>`
    : renderSvgChart(data, color, chartType, colorMode === "multi" ? colors : undefined);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />
      <div className="wrap">
        <svg className="chart-svg" viewBox={getViewBox(chartType)} preserveAspectRatio={chartType === "pie" ? "xMidYMid meet" : "none"}
          xmlns="http://www.w3.org/2000/svg"
          dangerouslySetInnerHTML={{ __html: svgContent }} />

        {/* Controls: pill toggle + refresh button (fade in on hover) */}
        <div className="lg-controls">
          <div className="lg-pill">
            <div className="lg-bubble" />
            <button id="moonBtn" className="lg-opt" title="Dark mode">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            </button>
            <button id="sunBtn" className="lg-opt" title="Light mode">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="4.5"/>
                <line x1="12" y1="2" x2="12" y2="4.5"/>
                <line x1="12" y1="19.5" x2="12" y2="22"/>
                <line x1="4.22" y1="4.22" x2="5.88" y2="5.88"/>
                <line x1="18.12" y1="18.12" x2="19.78" y2="19.78"/>
                <line x1="2" y1="12" x2="4.5" y2="12"/>
                <line x1="19.5" y1="12" x2="22" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.88" y2="18.12"/>
                <line x1="18.12" y1="5.88" x2="19.78" y2="4.22"/>
              </svg>
            </button>
          </div>

          {/* Circular refresh button */}
          <button id="refreshBtn" className="lg-refresh" title="Refresh">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>


        {isDebug && (
          <div style={{
            position:"fixed", top:0, left:0, right:0,
            background:"rgba(0,0,0,0.92)", color:"#0f0",
            fontFamily:"monospace", fontSize:12, padding:"8px 12px",
            lineHeight:1.8, zIndex:99999,
          }}>
            <b>id:</b> {id || "(none)"} &nbsp;|&nbsp;
            <b>kv:</b> {kvStatus} &nbsp;|&nbsp;
            <b>color:</b> {color} &nbsp;|&nbsp;
            <b>db:</b> {databaseId ? databaseId.slice(0,8)+"…" : "(none)"}
          </div>
        )}
      </div>
      <script dangerouslySetInnerHTML={{ __html: TOGGLE_SCRIPT }} />
    </>
  );
}
