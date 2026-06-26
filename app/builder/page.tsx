"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChartPreview } from "@/components/ChartPreview";
import { ChartConfig, ChartType, NotionDatabase, NotionProperty } from "@/lib/types";

const CHART_TYPES: { value: ChartType; label: string; icon: string }[] = [
  { value: "line", label: "折線圖", icon: "📈" },
  { value: "bar", label: "長條圖", icon: "📊" },
  { value: "pie", label: "圓餅圖", icon: "🥧" },
];

const COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#a855f7"];

export default function BuilderPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [databases, setDatabases] = useState<NotionDatabase[]>([]);
  const [selectedDb, setSelectedDb] = useState<NotionDatabase | null>(null);
  const [properties, setProperties] = useState<NotionProperty[]>([]);
  const [chartType, setChartType] = useState<ChartType>("line");
  const [xField, setXField] = useState("");
  const [yField, setYField] = useState("");
  const [chartName, setChartName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [previewData, setPreviewData] = useState<{ x: any; y: any }[]>([]);
  const [loadingDbs, setLoadingDbs] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    async function init() {
      const t = localStorage.getItem("notion_token");
      if (!t) { router.push("/setup"); return; }
      setToken(t);

      const dbs = await fetchDatabases(t);

      const id = new URLSearchParams(window.location.search).get("id");
      if (id) {
        setEditId(id);
        await loadEditChart(id, dbs, t);
      }
    }
    init();
  }, []);

  async function fetchDatabases(t: string): Promise<NotionDatabase[]> {
    setLoadingDbs(true);
    try {
      const res = await fetch("/api/notion/databases", {
        headers: { "x-notion-token": t },
      });
      const json = await res.json();
      const dbs: NotionDatabase[] = json.databases || [];
      setDatabases(dbs);
      return dbs;
    } finally {
      setLoadingDbs(false);
    }
  }

  async function loadEditChart(id: string, dbs: NotionDatabase[], t: string) {
    const res = await fetch(`/api/charts?id=${id}`);
    const json = await res.json();
    if (!json.chart) return;

    const chart = json.chart;
    setChartName(chart.name || "");
    setChartType(chart.chartType || "line");
    setColor(chart.color || COLORS[0]);
    setXField(chart.xField || "");
    setYField(chart.yField || "");

    const db = dbs.find((d) => d.id === chart.databaseId);
    if (!db) return;
    setSelectedDb(db);

    const [schemaRes, previewRes] = await Promise.all([
      fetch(`/api/notion/schema?databaseId=${db.id}`, { headers: { "x-notion-token": t } }),
      fetch(`/api/notion/query?databaseId=${db.id}&xField=${encodeURIComponent(chart.xField)}&yField=${encodeURIComponent(chart.yField)}`, { headers: { "x-notion-token": t } }),
    ]);
    const [schemaJson, previewJson] = await Promise.all([schemaRes.json(), previewRes.json()]);
    setProperties(schemaJson.properties || []);
    setPreviewData(previewJson.data || []);
    setStep(3);
  }

  async function handleSelectDb(db: NotionDatabase) {
    setSelectedDb(db);
    setXField(""); setYField(""); setPreviewData([]);
    const res = await fetch(`/api/notion/schema?databaseId=${db.id}`, {
      headers: { "x-notion-token": token },
    });
    const json = await res.json();
    setProperties(json.properties || []);
    setStep(2);
  }

  async function handlePreview() {
    if (!selectedDb || !xField || !yField) return;
    setLoadingPreview(true);
    try {
      const res = await fetch(
        `/api/notion/query?databaseId=${selectedDb.id}&xField=${encodeURIComponent(xField)}&yField=${encodeURIComponent(yField)}`,
        { headers: { "x-notion-token": token } }
      );
      const json = await res.json();
      setPreviewData(json.data || []);
      setStep(3);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleSave() {
    const name = chartName || `${selectedDb!.name} - ${yField}`;
    const config = {
      name,
      databaseId: selectedDb!.id,
      databaseName: selectedDb!.name,
      chartType,
      xField,
      yField,
      color,
      createdAt: Date.now(),
    };

    const existing: ChartConfig[] = JSON.parse(localStorage.getItem("notion_charts") || "[]");

    if (editId) {
      // Update in localStorage
      const updated = existing.map((c) =>
        c.id === editId ? { ...c, ...config } : c
      );
      localStorage.setItem("notion_charts", JSON.stringify(updated));
      // Try server update (best-effort)
      fetch(`/api/charts?id=${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      }).catch(() => {});
    } else {
      const newId = crypto.randomUUID();
      const newChart: ChartConfig = { id: newId, ...config };
      localStorage.setItem("notion_charts", JSON.stringify([...existing, newChart]));
      // Try server save (best-effort)
      fetch("/api/charts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      }).catch(() => {});
    }

    router.push("/");
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push("/")} className="btn-ghost px-3 py-2 text-sm">← 返回</button>
          <h1 className="text-xl font-semibold text-white">{editId ? "編輯圖表" : "建立新圖表"}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Config */}
          <div className="space-y-4">

            {/* Step 1: Select Database */}
            <div className="glass p-5">
              <h2 className="text-sm font-medium text-white mb-3">1. 選擇 Database</h2>
              {loadingDbs ? (
                <p className="text-sm" style={{ color: "var(--muted)" }}>載入中...</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {databases.map((db) => (
                    <button
                      key={db.id}
                      onClick={() => handleSelectDb(db)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all"
                      style={{
                        background: selectedDb?.id === db.id ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${selectedDb?.id === db.id ? "var(--accent)" : "var(--border)"}`,
                        color: selectedDb?.id === db.id ? "white" : "var(--muted)",
                      }}
                    >
                      📋 {db.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: Configure */}
            {step >= 2 && (
              <div className="glass p-5 space-y-4">
                <h2 className="text-sm font-medium text-white">2. 設定圖表</h2>

                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>圖表類型</label>
                  <div className="flex gap-2">
                    {CHART_TYPES.map((ct) => (
                      <button
                        key={ct.value}
                        onClick={() => setChartType(ct.value)}
                        className="flex-1 py-2 rounded-lg text-sm transition-all"
                        style={{
                          background: chartType === ct.value ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${chartType === ct.value ? "var(--accent)" : "var(--border)"}`,
                          color: chartType === ct.value ? "white" : "var(--muted)",
                        }}
                      >
                        {ct.icon} {ct.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>
                    X 軸（日期/類別）
                  </label>
                  <select
                    className="glass-input"
                    value={xField}
                    onChange={(e) => setXField(e.target.value)}
                  >
                    <option value="">選擇欄位</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.name}>{p.name} ({p.type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>
                    Y 軸（數值）
                  </label>
                  <select
                    className="glass-input"
                    value={yField}
                    onChange={(e) => setYField(e.target.value)}
                  >
                    <option value="">選擇欄位</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.name}>{p.name} ({p.type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>顏色</label>
                  <div className="flex gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className="w-8 h-8 rounded-full transition-transform"
                        style={{
                          background: c,
                          transform: color === c ? "scale(1.25)" : "scale(1)",
                          outline: color === c ? `2px solid white` : "none",
                          outlineOffset: "2px",
                        }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  className="btn-primary w-full"
                  onClick={handlePreview}
                  disabled={!xField || !yField || loadingPreview}
                >
                  {loadingPreview ? "載入資料中..." : "預覽圖表"}
                </button>
              </div>
            )}

            {/* Step 3: Save */}
            {step >= 3 && previewData.length > 0 && (
              <div className="glass p-5 space-y-3">
                <h2 className="text-sm font-medium text-white">3. 命名並儲存</h2>
                <input
                  className="glass-input"
                  placeholder={`${selectedDb?.name} - ${yField}`}
                  value={chartName}
                  onChange={(e) => setChartName(e.target.value)}
                />
                <button className="btn-primary w-full" onClick={handleSave}>
                  {editId ? "更新圖表" : "儲存圖表"}
                </button>
              </div>
            )}
          </div>

          {/* Right: Preview */}
          <div className="glass p-5">
            <h2 className="text-sm font-medium text-white mb-4">預覽</h2>
            {previewData.length > 0 ? (
              <ChartPreview
                data={previewData}
                chartType={chartType}
                color={color}
                xField={xField}
                yField={yField}
              />
            ) : (
              <div
                className="flex items-center justify-center h-64 rounded-xl text-sm"
                style={{ background: "rgba(255,255,255,0.02)", color: "var(--muted)" }}
              >
                設定完成後點擊「預覽圖表」
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
