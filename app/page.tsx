"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChartConfig } from "@/lib/types";
import { renderSvgChart, getViewBox } from "@/lib/chartSvg";

// ── Icons ────────────────────────────────────────────────────────────────────
const ChartsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);
const EditIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);

const LineChartIcon = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3,17 8,9 13,13 21,4"/>
  </svg>
);
const BarChartIcon = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="4" height="10" rx="0.8"/><rect x="10" y="6" width="4" height="15" rx="0.8"/><rect x="17" y="3" width="4" height="18" rx="0.8"/>
  </svg>
);
const PieChartIcon = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v10l7.4 4.3"/><circle cx="12" cy="12" r="10"/>
  </svg>
);

function ChartTypeIcon({ type, color }: { type: string; color: string }) {
  if (type === "bar") return <BarChartIcon color={color} />;
  if (type === "pie") return <PieChartIcon color={color} />;
  return <LineChartIcon color={color} />;
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [chartData, setChartData] = useState<Record<string, { x: any; y: any }[]>>({});
  const [copied, setCopied] = useState<string | null>(null);

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
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: "rgba(255,255,255,0.58)",
        backdropFilter: "blur(28px) saturate(200%)",
        WebkitBackdropFilter: "blur(28px) saturate(200%)",
        borderRight: "1px solid rgba(0,0,0,0.06)",
        display: "flex", flexDirection: "column",
        boxShadow: "2px 0 16px rgba(0,0,0,0.03)",
      }}>

        {/* Logo */}
        <div style={{ padding: "22px 18px 14px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3,17 8,9 13,13 21,4"/>
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#111", letterSpacing: "-0.01em" }}>Notion Charts</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "12px 10px", flex: 1 }}>
          <button className="nav-item active">
            <ChartsIcon />
            My Charts
          </button>
        </nav>

        {/* Bottom */}
        <div style={{ padding: "12px 10px", borderTop: "1px solid rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: 2 }}>
          <button className="nav-item" onClick={() => router.push("/setup")}>
            <SettingsIcon />
            Settings
          </button>
          <button className="nav-item" onClick={() => { localStorage.removeItem("notion_token"); router.push("/setup"); }}>
            <SwitchIcon />
            Switch Account
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: "auto", padding: "32px 32px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111", margin: 0, letterSpacing: "-0.02em" }}>
              My Charts
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "3px 0 0" }}>
              {charts.length} chart{charts.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button className="btn-primary" onClick={() => router.push("/builder")}>
            <PlusIcon /> New Chart
          </button>
        </div>

        {/* Empty state */}
        {charts.length === 0 && (
          <div className="glass" style={{ padding: "64px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>📈</div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#111", margin: "0 0 8px" }}>No charts yet</h2>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 24px" }}>
              Create your first chart from a Notion database
            </p>
            <button className="btn-primary" onClick={() => router.push("/builder")}>
              <PlusIcon /> Create Chart
            </button>
          </div>
        )}

        {/* Chart grid */}
        <div className="chart-grid">
          {charts.map((config) => {
            const data = chartData[config.id];
            const cardColor = config.color || "#6366f1";

            return (
              <div key={config.id} className="glass" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>

                {/* Card header */}
                <div style={{ padding: "14px 16px 12px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: `${cardColor}18`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginTop: 1,
                  }}>
                    <ChartTypeIcon type={config.chartType || "line"} color={cardColor} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#111", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {config.name}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--muted)", margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {config.databaseName} · {config.xField} × {config.yField}
                    </p>
                  </div>
                </div>

                {/* Chart preview */}
                <div style={{
                  background: "#191919", margin: "0 0",
                  position: "relative", overflow: "hidden",
                  ["--bg" as any]: "#191919",
                  ["--label" as any]: "#6b7280",
                  ["--grid" as any]: "rgba(255,255,255,0.08)",
                }}>
                  {data ? (
                    <svg
                      viewBox={getViewBox(config.chartType || "line")}
                      preserveAspectRatio="xMidYMid meet"
                      style={{ width: "100%", height: "auto", display: "block", maxHeight: 180 }}
                      xmlns="http://www.w3.org/2000/svg"
                      dangerouslySetInnerHTML={{
                        __html: renderSvgChart(
                          data,
                          cardColor,
                          config.chartType || "line",
                          config.colorMode === "multi" && config.colors?.length ? config.colors : undefined
                        )
                      }}
                    />
                  ) : (
                    <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%",
                        border: "2px solid rgba(255,255,255,0.1)",
                        borderTopColor: cardColor,
                        animation: "spin 0.8s linear infinite",
                      }} />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ padding: "10px 12px", display: "flex", gap: 6, borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                  <button
                    className={`btn-accent-ghost${copied === config.id ? " copied" : ""}`}
                    onClick={() => copyEmbedUrl(config)}
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    <LinkIcon />
                    {copied === config.id ? "Copied ✓" : "Copy URL"}
                  </button>
                  <button className="btn-ghost" onClick={() => router.push(`/builder?id=${config.id}`)}>
                    <EditIcon /> Edit
                  </button>
                  <button className="btn-danger" onClick={() => deleteChart(config.id)}>
                    <TrashIcon />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
