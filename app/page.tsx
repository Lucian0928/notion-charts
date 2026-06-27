"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChartConfig } from "@/lib/types";
import { renderSvgChart, getViewBox } from "@/lib/chartSvg";

// ── Icons ────────────────────────────────────────────────────────────────────
const ChartsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="4" height="10" rx="1"/><rect x="10" y="6" width="4" height="15" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>
  </svg>
);
const SettingsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const SwitchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const LinkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);
const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const DotsIcon = () => (
  <svg width="14" height="4" viewBox="0 0 14 4" fill="currentColor">
    <circle cx="1.75" cy="2" r="1.5"/><circle cx="7" cy="2" r="1.5"/><circle cx="12.25" cy="2" r="1.5"/>
  </svg>
);

const LineChartIcon = ({ color }: { color: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3,17 8,9 13,13 21,4"/>
  </svg>
);
const BarChartIcon = ({ color }: { color: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="4" height="10" rx="0.8"/><rect x="10" y="6" width="4" height="15" rx="0.8"/><rect x="17" y="3" width="4" height="18" rx="0.8"/>
  </svg>
);
const PieChartIcon = ({ color }: { color: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v10l7.4 4.3"/><circle cx="12" cy="12" r="10"/>
  </svg>
);
function ChartTypeIcon({ type, color }: { type: string; color: string }) {
  if (type === "bar") return <BarChartIcon color={color} />;
  if (type === "pie") return <PieChartIcon color={color} />;
  return <LineChartIcon color={color} />;
}

// ── Shared glass styles ───────────────────────────────────────────────────────
const glassBox: React.CSSProperties = {
  background: "rgba(255,255,255,0.55)",
  backdropFilter: "blur(16px) saturate(180%)",
  WebkitBackdropFilter: "blur(16px) saturate(180%)",
  border: "1px solid rgba(255,255,255,0.82)",
  boxShadow: "0 1px 6px rgba(0,0,0,0.07), 0 1px 0 rgba(255,255,255,1) inset",
};
const menuItemBase: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 9,
  width: "100%", padding: "9px 14px",
  border: "none", background: "none",
  fontSize: 13, fontWeight: 500,
  textAlign: "left", cursor: "pointer",
  color: "#374151", transition: "background 0.12s",
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [charts,    setCharts]    = useState<ChartConfig[]>([]);
  const [chartData, setChartData] = useState<Record<string, { x: any; y: any }[]>>({});
  const [copied,    setCopied]    = useState<string | null>(null);
  const [menuOpen,  setMenuOpen]  = useState<string | null>(null);
  const [search,    setSearch]    = useState("");

  const q = search.trim().toLowerCase();
  const filtered = q
    ? charts.filter(c =>
        [c.name, c.databaseName, c.xField, c.yField]
          .some(s => s?.toLowerCase().includes(q))
      )
    : charts;

  async function fetchChartData(config: ChartConfig, t: string) {
    try {
      const res = await fetch(
        `/api/notion/query?databaseId=${config.databaseId}&xField=${encodeURIComponent(config.xField)}&yField=${encodeURIComponent(config.yField)}`,
        { headers: { "x-notion-token": t } }
      );
      const json = await res.json();
      setChartData((prev) => ({ ...prev, [config.id]: json.data || [] }));
    } catch {}
  }

  useEffect(() => {
    async function init() {
      const t = localStorage.getItem("notion_token");
      if (!t) { router.push("/setup"); return; }
      const local: ChartConfig[] = JSON.parse(localStorage.getItem("notion_charts") || "[]");
      try {
        const res = await fetch("/api/charts");
        const json = await res.json();
        if (json.storage !== "unavailable" && Array.isArray(json.charts) && json.charts.length > 0) {
          setCharts(json.charts);
          localStorage.setItem("notion_charts", JSON.stringify(json.charts));
          json.charts.forEach((c: ChartConfig) => fetchChartData(c, t));
          return;
        }
        if (local.length > 0 && json.storage !== "unavailable") {
          for (const c of local) {
            fetch("/api/charts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) }).catch(() => {});
          }
        }
      } catch {}
      setCharts(local);
      local.forEach((c: ChartConfig) => fetchChartData(c, t));
    }
    init();
  }, [router]);

  async function deleteChart(id: string) {
    const updated = charts.filter((c) => c.id !== id);
    setCharts(updated);
    localStorage.setItem("notion_charts", JSON.stringify(updated));
    fetch(`/api/charts?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  }

  function getEmbedUrl(config: ChartConfig): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    return `${base}/embed?id=${config.id}`;
  }
  function copyEmbedUrl(config: ChartConfig) {
    navigator.clipboard.writeText(getEmbedUrl(config));
    setCopied(config.id);
    setTimeout(() => setCopied(null), 2200);
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: "rgba(255,255,255,0.52)",
        backdropFilter: "blur(28px) saturate(200%)",
        WebkitBackdropFilter: "blur(28px) saturate(200%)",
        borderRight: "1px solid rgba(0,0,0,0.055)",
        display: "flex", flexDirection: "column",
        boxShadow: "2px 0 20px rgba(0,0,0,0.03)",
      }}>

        {/* Logo */}
        <div style={{ padding: "20px 16px 14px", borderBottom: "1px solid rgba(0,0,0,0.045)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            {/* Glass liquid logo box */}
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              ...glassBox,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3,17 8,9 13,13 21,4"/>
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#111", letterSpacing: "-0.01em" }}>
              Notion Charts
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "10px 10px", flex: 1 }}>
          {/* Active: glass liquid white bubble, neutral text */}
          <button style={{
            display: "flex", alignItems: "center", gap: 9,
            padding: "8px 10px", borderRadius: 8, width: "100%",
            fontSize: 13, fontWeight: 600, color: "#1f2937",
            cursor: "pointer", border: "none", textAlign: "left",
            ...glassBox,
          }}>
            <ChartsIcon />
            My Charts
          </button>
        </nav>

        {/* Bottom */}
        <div style={{ padding: "10px 10px", borderTop: "1px solid rgba(0,0,0,0.045)", display: "flex", flexDirection: "column", gap: 2 }}>
          <button className="nav-item" onClick={() => router.push("/setup")}>
            <SettingsIcon /> Settings
          </button>
          <button className="nav-item" onClick={() => { localStorage.removeItem("notion_token"); router.push("/setup"); }}>
            <SwitchIcon /> Switch Account
          </button>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: "auto", padding: "32px 32px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <div style={{ flexShrink: 0 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111", margin: 0, letterSpacing: "-0.02em" }}>
              My Charts
            </h1>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "3px 0 0" }}>
              {q ? `${filtered.length} of ${charts.length}` : `${charts.length} chart${charts.length !== 1 ? "s" : ""}`}
            </p>
          </div>

          {/* Search bar */}
          <div style={{ flex: 1, position: "relative", maxWidth: 360 }}>
            <span style={{
              position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
              pointerEvents: "none", display: "flex",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search charts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "8px 12px 8px 32px",
                background: "rgba(255,255,255,0.62)",
                backdropFilter: "blur(16px) saturate(180%)",
                WebkitBackdropFilter: "blur(16px) saturate(180%)",
                border: "1px solid rgba(255,255,255,0.88)",
                boxShadow: "0 1px 6px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,1) inset",
                borderRadius: 10, fontSize: 13, color: "#111", outline: "none",
              }}
              onFocus={e => { e.currentTarget.style.border = "1px solid rgba(0,0,0,0.15)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,0,0,0.05), 0 1px 0 rgba(255,255,255,1) inset"; }}
              onBlur={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.88)"; e.currentTarget.style.boxShadow = "0 1px 6px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,1) inset"; }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  width: 18, height: 18, borderRadius: "50%", border: "none",
                  background: "rgba(0,0,0,0.1)", color: "#6b7280",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", fontSize: 11, lineHeight: 1,
                }}
              >✕</button>
            )}
          </div>

          <button className="btn-primary" style={{ flexShrink: 0, marginLeft: "auto" }} onClick={() => router.push("/builder")}>
            <PlusIcon /> New Chart
          </button>
        </div>

        {/* Empty state — no charts at all */}
        {charts.length === 0 && (
          <div className="glass" style={{ padding: "64px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>📈</div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#111", margin: "0 0 8px" }}>No charts yet</h2>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 22px" }}>
              Create your first chart from a Notion database
            </p>
            <button className="btn-primary" onClick={() => router.push("/builder")}>
              <PlusIcon /> Create Chart
            </button>
          </div>
        )}

        {/* Overlay to close dropdown on outside click */}
        {menuOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(null)} />
        )}

        {/* Empty state — search no results */}
        {charts.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 32px", color: "var(--muted)" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#374151", margin: "0 0 6px" }}>No results for &ldquo;{search}&rdquo;</p>
            <p style={{ fontSize: 13, margin: 0 }}>Try searching by chart name or database name</p>
          </div>
        )}

        {/* Grid */}
        <div className="chart-grid">
          {filtered.map((config) => {
            const data = chartData[config.id];
            const cardColor = config.color || "#6366f1";
            const isMenuOpen = menuOpen === config.id;
            const wasCopied = copied === config.id;

            return (
              <div key={config.id} className="glass" style={{ padding: 0, overflow: "visible", display: "flex", flexDirection: "column" }}>

                {/* Card header */}
                <div style={{ padding: "13px 14px 11px", display: "flex", alignItems: "center", gap: 9, position: "relative" }}>
                  {/* Chart type icon */}
                  <div style={{
                    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                    background: `${cardColor}15`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <ChartTypeIcon type={config.chartType || "line"} color={cardColor} />
                  </div>

                  {/* Title + subtitle */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#111", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {config.name}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--muted)", margin: "1px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {config.databaseName} · {config.xField} × {config.yField}
                    </p>
                  </div>

                  {/* Three-dot button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(isMenuOpen ? null : config.id); }}
                    style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      ...glassBox,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", color: "#6b7280",
                    }}
                  >
                    <DotsIcon />
                  </button>

                  {/* Dropdown */}
                  {isMenuOpen && (
                    <div style={{
                      position: "absolute", top: 44, right: 0, zIndex: 50,
                      background: "rgba(255,255,255,0.88)",
                      backdropFilter: "blur(24px) saturate(200%)",
                      WebkitBackdropFilter: "blur(24px) saturate(200%)",
                      border: "1px solid rgba(255,255,255,0.95)",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.1), 0 1px 0 rgba(255,255,255,1) inset",
                      borderRadius: 11, overflow: "hidden", minWidth: 158,
                    }}>
                      <button
                        style={{ ...menuItemBase, color: wasCopied ? "#059669" : "#374151" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                        onClick={() => { copyEmbedUrl(config); }}
                      >
                        <LinkIcon />
                        {wasCopied ? "Copied ✓" : "Copy Embed URL"}
                      </button>
                      <div style={{ height: 1, background: "rgba(0,0,0,0.05)", margin: "0 10px" }} />
                      <button
                        style={menuItemBase}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                        onClick={() => { setMenuOpen(null); router.push(`/builder?id=${config.id}`); }}
                      >
                        <EditIcon /> Edit
                      </button>
                      <div style={{ height: 1, background: "rgba(0,0,0,0.05)", margin: "0 10px" }} />
                      <button
                        style={{ ...menuItemBase, color: "#e11d48" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(244,63,94,0.06)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                        onClick={() => { setMenuOpen(null); deleteChart(config.id); }}
                      >
                        <TrashIcon /> Delete
                      </button>
                    </div>
                  )}
                </div>

                {/* Chart preview — dark "screen" aesthetic with refined edges */}
                <div style={{
                  margin: "0 12px 12px",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "#1c1c1e",
                  border: "1px solid rgba(0,0,0,0.18)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.12) inset",
                  ["--bg" as any]: "#1c1c1e",
                  ["--label" as any]: "#6b7280",
                  ["--grid" as any]: "rgba(255,255,255,0.07)",
                }}>
                  {data ? (
                    <svg
                      viewBox={getViewBox(config.chartType || "line")}
                      preserveAspectRatio="xMidYMid meet"
                      style={{ width: "100%", height: "auto", display: "block", maxHeight: 185 }}
                      xmlns="http://www.w3.org/2000/svg"
                      dangerouslySetInnerHTML={{
                        __html: renderSvgChart(
                          data, cardColor,
                          config.chartType || "line",
                          config.colorMode === "multi" && config.colors?.length ? config.colors : undefined
                        )
                      }}
                    />
                  ) : (
                    <div style={{ height: 118, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%",
                        border: `2px solid ${cardColor}33`,
                        borderTopColor: cardColor,
                        animation: "spin 0.8s linear infinite",
                      }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
