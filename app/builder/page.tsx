"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChartPreview } from "@/components/ChartPreview";
import { ChartConfig, ChartType, NotionDatabase, NotionProperty } from "@/lib/types";

const CHART_TYPES: { value: ChartType; icon: string; title: string }[] = [
  { value: "line", icon: "📈", title: "Line Chart" },
  { value: "bar", icon: "📊", title: "Bar Chart" },
  { value: "pie", icon: "🥧", title: "Pie Chart" },
];

const COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
  "#f43f5e", "#f97316", "#f59e0b", "#eab308",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
  "#22d3ee", "#3b82f6", "#64748b", "#e2e8f0",
];

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
    // Read chart from localStorage (source of truth)
    const local: ChartConfig[] = JSON.parse(localStorage.getItem("notion_charts") || "[]");
    const chart = local.find((c) => c.id === id);
    if (!chart) return;

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
      fetch(
        `/api/notion/query?databaseId=${db.id}&xField=${encodeURIComponent(chart.xField)}&yField=${encodeURIComponent(chart.yField)}`,
        { headers: { "x-notion-token": t } }
      ),
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
      const updated = existing.map((c) =>
        c.id === editId ? { ...c, ...config } : c
      );
      localStorage.setItem("notion_charts", JSON.stringify(updated));
      fetch(`/api/charts?id=${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      }).catch(() => {});
    } else {
      const newId = crypto.randomUUID();
      const newChart: ChartConfig = { id: newId, ...config };
      localStorage.setItem("notion_charts", JSON.stringify([...existing, newChart]));
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
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push("/")} className="btn-ghost px-3 py-2 text-sm">← Back</button>
          <h1 className="text-xl font-semibold text-white">{editId ? "Edit Chart" : "New Chart"}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">

            {/* Step 1: Select Database */}
            <div className="glass p-5">
              <h2 className="text-sm font-medium text-white mb-3">1. Select Database</h2>
              {loadingDbs ? (
                <p className="text-sm" style={{ color: "var(--muted)" }}>Loading...</p>
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
                <h2 className="text-sm font-medium text-white">2. Configure</h2>

                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Chart Type</label>
                  <div className="flex gap-2">
                    {CHART_TYPES.map((ct) => (
                      <button
                        key={ct.value}
                        onClick={() => setChartType(ct.value)}
                        title={ct.title}
                        className="flex-1 py-2 rounded-lg text-lg transition-all"
                        style={{
                          background: chartType === ct.value ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${chartType === ct.value ? "rgba(255,255,255,0.3)" : "var(--border)"}`,
                        }}
                      >
                        {ct.icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>X Axis</label>
                  <select
                    className="glass-input"
                    value={xField}
                    onChange={(e) => setXField(e.target.value)}
                  >
                    <option value="">Select field</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.name}>{p.name} ({p.type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Y Axis</label>
                  <select
                    className="glass-input"
                    value={yField}
                    onChange={(e) => setYField(e.target.value)}
                  >
                    <option value="">Select field</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.name}>{p.name} ({p.type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs mb-2" style={{ color: "var(--muted)" }}>Color</label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className="w-7 h-7 rounded-full transition-transform"
                        style={{
                          background: c,
                          transform: color === c ? "scale(1.3)" : "scale(1)",
                          outline: color === c ? "2px solid white" : "none",
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
                  {loadingPreview ? "Loading..." : "Preview"}
                </button>
              </div>
            )}

            {/* Step 3: Save */}
            {step >= 3 && previewData.length > 0 && (
              <div className="glass p-5 space-y-3">
                <h2 className="text-sm font-medium text-white">3. Name & Save</h2>
                <input
                  className="glass-input"
                  placeholder={`${selectedDb?.name} - ${yField}`}
                  value={chartName}
                  onChange={(e) => setChartName(e.target.value)}
                />
                <button className="btn-primary w-full" onClick={handleSave}>
                  {editId ? "Update Chart" : "Save Chart"}
                </button>
              </div>
            )}
          </div>

          {/* Right: Preview */}
          <div className="glass p-5">
            <h2 className="text-sm font-medium text-white mb-4">Preview</h2>
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
                Configure fields then click Preview
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
