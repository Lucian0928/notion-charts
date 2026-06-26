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
      } catch {}

      setCharts(local);
      local.forEach((c: ChartConfig) => fetchChartData(c, t));
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
    const updated = charts.filter((c) => c.id !== id);
    setCharts(updated);
    localStorage.setItem("notion_charts", JSON.stringify(updated));
    fetch(`/api/charts?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-white">📊 Notion Charts</h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              {charts.length} chart{charts.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { localStorage.removeItem("notion_token"); router.push("/setup"); }}
              className="btn-ghost text-sm"
            >
              Switch Account
            </button>
            <button onClick={() => router.push("/builder")} className="btn-primary">
              + New Chart
            </button>
          </div>
        </div>

        {charts.length === 0 && (
          <div className="glass flex flex-col items-center justify-center py-24 text-center">
            <div className="text-5xl mb-4">📈</div>
            <h2 className="text-lg font-medium text-white mb-2">No charts yet</h2>
            <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
              Create your first chart from a Notion database
            </p>
            <button onClick={() => router.push("/builder")} className="btn-primary">
              Create Chart
            </button>
          </div>
        )}

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
                    {copied === config.id ? "Copied ✓" : "Copy Embed URL"}
                  </button>
                  <button
                    onClick={() => router.push(`/builder?id=${config.id}`)}
                    className="text-xs px-2 py-1.5 rounded-lg transition-all"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "var(--muted)",
                    }}
                  >
                    Edit
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
                    Delete
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
                  Loading...
                </div>
              )}

              <p className="text-xs mt-2 text-right" style={{ color: "var(--muted)" }}>
                {chartData[config.id]?.length ?? "—"} entries
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
