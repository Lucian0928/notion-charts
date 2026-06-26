"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChartConfig } from "@/lib/types";
import { ChartPreview } from "@/components/ChartPreview";

export default function DashboardPage() {
  const router = useRouter();
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [chartData, setChartData] = useState<Record<string, { x: any; y: any }[]>>({});
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const t = localStorage.getItem("notion_token");
      if (!t) { router.push("/setup"); return; }
      setToken(t);

      // Load charts from server (Notion-backed)
      const res = await fetch("/api/charts");
      const json = await res.json();
      let loaded: ChartConfig[] = json.charts || [];

      // One-time migration from localStorage
      if (loaded.length === 0 && json.storage !== "unavailable") {
        const local: ChartConfig[] = JSON.parse(localStorage.getItem("notion_charts") || "[]");
        if (local.length > 0) {
          const migrated: ChartConfig[] = [];
          for (const c of local) {
            const r = await fetch("/api/charts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(c),
            });
            const rj = await r.json();
            if (rj.id) migrated.push({ ...c, id: rj.id });
          }
          loaded = migrated;
          localStorage.removeItem("notion_charts");
        }
      }

      // Fallback: if API storage unavailable, read localStorage
      if (json.storage === "unavailable") {
        loaded = JSON.parse(localStorage.getItem("notion_charts") || "[]");
      }

      setCharts(loaded);
      loaded.forEach((c: ChartConfig) => fetchChartData(c, t));
    }
    init();
  }, []);

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

  async function deleteChart(id: string) {
    setCharts((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/charts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  function getEmbedUrl(config: ChartConfig): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const params = new URLSearchParams({
      databaseId: config.databaseId,
      xField: config.xField,
      yField: config.yField,
      chartType: config.chartType,
      color: config.color,
      title: config.name,
    });
    return `${base}/embed?${params.toString()}`;
  }

  function copyEmbedUrl(config: ChartConfig) {
    navigator.clipboard.writeText(getEmbedUrl(config));
    setCopied(config.id);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-white">📊 Notion Charts</h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              {charts.length} 個圖表
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { localStorage.removeItem("notion_token"); router.push("/setup"); }}
              className="btn-ghost text-sm"
            >
              切換帳號
            </button>
            <button onClick={() => router.push("/builder")} className="btn-primary">
              + 新增圖表
            </button>
          </div>
        </div>

        {/* Empty state */}
        {charts.length === 0 && (
          <div className="glass flex flex-col items-center justify-center py-24 text-center">
            <div className="text-5xl mb-4">📈</div>
            <h2 className="text-lg font-medium text-white mb-2">還沒有圖表</h2>
            <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
              從你的 Notion database 建立第一個圖表
            </p>
            <button onClick={() => router.push("/builder")} className="btn-primary">
              建立圖表
            </button>
          </div>
        )}

        {/* Charts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {charts.map((config) => (
            <div key={config.id} className="glass p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-medium text-white text-sm">{config.name}</h3>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                    {config.databaseName} · {config.xField} × {config.yField}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyEmbedUrl(config)}
                    className="text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{
                      background: copied === config.id ? "rgba(16,185,129,0.2)" : "rgba(99,102,241,0.15)",
                      border: `1px solid ${copied === config.id ? "rgba(16,185,129,0.4)" : "rgba(99,102,241,0.3)"}`,
                      color: copied === config.id ? "#10b981" : "var(--accent)",
                    }}
                  >
                    {copied === config.id ? "已複製 ✓" : "複製 Embed URL"}
                  </button>
                  <button
                    onClick={() => deleteChart(config.id)}
                    className="text-xs px-2 py-1.5 rounded-lg transition-all"
                    style={{
                      background: "rgba(244,63,94,0.1)",
                      border: "1px solid rgba(244,63,94,0.2)",
                      color: "#f43f5e",
                    }}
                  >
                    刪除
                  </button>
                </div>
              </div>

              {chartData[config.id] ? (
                <ChartPreview
                  data={chartData[config.id]}
                  chartType={config.chartType}
                  color={config.color}
                  xField={config.xField}
                  yField={config.yField}
                />
              ) : (
                <div
                  className="flex items-center justify-center h-48 rounded-xl text-sm"
                  style={{ background: "rgba(255,255,255,0.02)", color: "var(--muted)" }}
                >
                  載入中...
                </div>
              )}

              <p className="text-xs mt-2 text-right" style={{ color: "var(--muted)" }}>
                {chartData[config.id]?.length ?? "—"} 筆資料
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
