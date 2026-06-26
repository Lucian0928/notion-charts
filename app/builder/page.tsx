"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { renderSvgChart } from "@/lib/chartSvg";
import { ChartConfig, ChartType, NotionDatabase, NotionProperty } from "@/lib/types";

// ── SVG icons ────────────────────────────────────────────────────────────────
const LineIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3,17 8,9 13,13 21,4"/>
    <path d="M3,17 8,9 13,13 21,4 21,20 3,20 Z"
      fill="currentColor" fillOpacity="0.12" stroke="none"/>
  </svg>
);
const BarIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="4" height="10" rx="0.8"/>
    <rect x="10" y="6" width="4" height="15" rx="0.8"/>
    <rect x="17" y="3" width="4" height="18" rx="0.8"/>
  </svg>
);
const PieIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v10l7.4 4.3"/>
    <circle cx="12" cy="12" r="10"/>
  </svg>
);

const CHART_TYPES: { value: ChartType; title: string; Icon: () => React.ReactElement }[] = [
  { value: "line", title: "Line Chart",  Icon: LineIcon },
  { value: "bar",  title: "Bar Chart",   Icon: BarIcon  },
  { value: "pie",  title: "Pie Chart",   Icon: PieIcon  },
];

// ── Color presets ─────────────────────────────────────────────────────────────
const PRESETS = [
  "#6366f1","#8b5cf6","#a855f7","#ec4899",
  "#f43f5e","#f97316","#f59e0b","#eab308",
  "#22c55e","#10b981","#14b8a6","#06b6d4",
  "#22d3ee","#3b82f6","#64748b","#e2e8f0",
];

// ── Color utils ───────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
}
function validHex(h: string) { return /^#[0-9a-f]{6}$/i.test(h); }

// ── Sidebar label ─────────────────────────────────────────────────────────────
function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 500, color: "var(--muted, #6b7280)",
      textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
      {children}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function BuilderPage() {
  const router = useRouter();
  const colorInputRef = useRef<HTMLInputElement>(null);

  const [token,        setToken]        = useState("");
  const [editId,       setEditId]       = useState<string | null>(null);
  const [databases,    setDatabases]    = useState<NotionDatabase[]>([]);
  const [selectedDb,   setSelectedDb]   = useState<NotionDatabase | null>(null);
  const [properties,   setProperties]   = useState<NotionProperty[]>([]);
  const [chartType,    setChartType]    = useState<ChartType>("line");
  const [xField,       setXField]       = useState("");
  const [yField,       setYField]       = useState("");
  const [chartName,    setChartName]    = useState("");
  const [color,        setColor]        = useState(PRESETS[0]);
  const [hexInput,     setHexInput]     = useState(PRESETS[0]);
  const [rgb,          setRgb]          = useState<[number,number,number]>(hexToRgb(PRESETS[0]));
  const [previewData,  setPreviewData]  = useState<{ x: any; y: any }[]>([]);
  const [loadingDbs,   setLoadingDbs]   = useState(false);
  const [loadingPrev,  setLoadingPrev]  = useState(false);
  const [step,         setStep]         = useState(1);
  const [saving,       setSaving]       = useState(false);
  const [saveMsg,      setSaveMsg]      = useState<{ ok: boolean; text: string } | null>(null);

  // ── Color sync ──────────────────────────────────────────────────────────────
  function applyColor(hex: string) {
    if (!validHex(hex)) return;
    setColor(hex);
    setHexInput(hex);
    setRgb(hexToRgb(hex));
  }
  function applyRgb(r: number, g: number, b: number) {
    const hex = rgbToHex(r, g, b);
    setColor(hex);
    setHexInput(hex);
    setRgb([r, g, b]);
  }

  // ── Init ────────────────────────────────────────────────────────────────────
  async function fetchDatabases(t: string): Promise<NotionDatabase[]> {
    setLoadingDbs(true);
    try {
      const res  = await fetch("/api/notion/databases", { headers: { "x-notion-token": t } });
      const json = await res.json();
      const dbs: NotionDatabase[] = json.databases || [];
      setDatabases(dbs);
      return dbs;
    } finally { setLoadingDbs(false); }
  }

  useEffect(() => {
    async function init() {
      const t = localStorage.getItem("notion_token");
      if (!t) { router.push("/setup"); return; }
      setToken(t);
      const dbs = await fetchDatabases(t);
      const id = new URLSearchParams(window.location.search).get("id");
      if (id) { setEditId(id); await loadEditChart(id, dbs, t); } // eslint-disable-line
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadEditChart(id: string, dbs: NotionDatabase[], t: string) { // eslint-disable-line
    const local: ChartConfig[] = JSON.parse(localStorage.getItem("notion_charts") || "[]");
    const chart = local.find((c) => c.id === id);
    if (!chart) return;
    setChartName(chart.name || "");
    setChartType(chart.chartType || "line");
    applyColor(chart.color || PRESETS[0]);
    setXField(chart.xField || "");
    setYField(chart.yField || "");
    const db = dbs.find((d) => d.id === chart.databaseId);
    if (!db) return;
    setSelectedDb(db);
    const [sr, pr] = await Promise.all([
      fetch(`/api/notion/schema?databaseId=${db.id}`, { headers: { "x-notion-token": t } }),
      fetch(`/api/notion/query?databaseId=${db.id}&xField=${encodeURIComponent(chart.xField)}&yField=${encodeURIComponent(chart.yField)}`, { headers: { "x-notion-token": t } }),
    ]);
    const [sj, pj] = await Promise.all([sr.json(), pr.json()]);
    setProperties(sj.properties || []);
    setPreviewData(pj.data || []);
    setStep(3);
  }

  async function handleSelectDb(db: NotionDatabase) {
    setSelectedDb(db); setXField(""); setYField(""); setPreviewData([]);
    const res  = await fetch(`/api/notion/schema?databaseId=${db.id}`, { headers: { "x-notion-token": token } });
    const json = await res.json();
    setProperties(json.properties || []);
    setStep(2);
  }

  async function handlePreview() {
    if (!selectedDb || !xField || !yField) return;
    setLoadingPrev(true);
    try {
      const res  = await fetch(`/api/notion/query?databaseId=${selectedDb.id}&xField=${encodeURIComponent(xField)}&yField=${encodeURIComponent(yField)}`, { headers: { "x-notion-token": token } });
      const json = await res.json();
      setPreviewData(json.data || []);
      setStep(3);
    } finally { setLoadingPrev(false); }
  }

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    let notionOk = false;
    try {
    const name   = chartName || `${selectedDb!.name} - ${yField}`;
    const config = { name, databaseId: selectedDb!.id, databaseName: selectedDb!.name, chartType, xField, yField, color, createdAt: Date.now() };
    const existing: ChartConfig[] = JSON.parse(localStorage.getItem("notion_charts") || "[]");

    if (editId) {
      const chart    = existing.find(c => c.id === editId);
      const notionId = chart?.notionId;
      const updated  = existing.map(c => c.id === editId ? { ...c, ...config } : c);
      localStorage.setItem("notion_charts", JSON.stringify(updated));

      if (notionId) {
        try {
          const r = await fetch(`/api/charts?id=${notionId}`, {
            method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config),
          });
          const rj = await r.json();
          notionOk = rj.ok === true;
          if (!notionOk) setSaveMsg({ ok: false, text: `✗ Notion PUT failed: ${rj.error || JSON.stringify(rj)}` });
        } catch (e: any) { setSaveMsg({ ok: false, text: `✗ Notion PUT error: ${e.message}` }); }
      } else {
        // No Notion page yet — create one and back-fill notionId
        try {
          const r  = await fetch("/api/charts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
          const rj = await r.json();
          if (rj.id) {
            const charts: ChartConfig[] = JSON.parse(localStorage.getItem("notion_charts") || "[]");
            const idx = charts.findIndex(c => c.id === editId);
            if (idx >= 0) { charts[idx].notionId = rj.id; localStorage.setItem("notion_charts", JSON.stringify(charts)); }
            notionOk = true;
          } else { setSaveMsg({ ok: false, text: `✗ Notion POST failed: ${rj.error || JSON.stringify(rj)}` }); }
        } catch (e: any) { setSaveMsg({ ok: false, text: `✗ Notion POST error: ${e.message}` }); }
      }
    } else {
      const newId    = crypto.randomUUID();
      const newChart: ChartConfig = { id: newId, ...config };
      localStorage.setItem("notion_charts", JSON.stringify([...existing, newChart]));
      try {
        const r  = await fetch("/api/charts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
        const rj = await r.json();
        if (rj.id) {
          const charts: ChartConfig[] = JSON.parse(localStorage.getItem("notion_charts") || "[]");
          const idx = charts.findIndex(c => c.id === newId);
          if (idx >= 0) { charts[idx].notionId = rj.id; localStorage.setItem("notion_charts", JSON.stringify(charts)); }
          notionOk = true;
        } else { setSaveMsg({ ok: false, text: `✗ Notion POST failed: ${rj.error || JSON.stringify(rj)}` }); }
      } catch (e: any) { setSaveMsg({ ok: false, text: `✗ Notion POST error: ${e.message}` }); }
    }
    } catch (e: any) {
      console.error("[builder] handleSave error:", e);
    }
    setSaving(false);
    setSaveMsg(prev =>
      prev && !prev.ok
        ? prev  // keep specific error message already set
        : notionOk
          ? { ok: true,  text: "✓ Saved to Notion — embed auto-syncs" }
          : { ok: false, text: "✗ Notion sync failed — locally saved only" }
    );
    setTimeout(() => router.push("/"), 3000);
  }

  // ── Shared input style ──────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "8px 10px", color: "white", fontSize: 13, outline: "none",
  };
  const numInputStyle: React.CSSProperties = {
    ...inputStyle, width: 56, textAlign: "center", padding: "8px 4px",
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: "#0a0a0f" }}>

      {/* Full-screen save result banner — impossible to miss */}
      {saveMsg && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
        }}>
          <div style={{
            maxWidth: 480, width: "90%", padding: "24px 28px", borderRadius: 16,
            background: saveMsg.ok ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.18)",
            border: `1.5px solid ${saveMsg.ok ? "#10b981" : "#ef4444"}`,
            color: saveMsg.ok ? "#6ee7b7" : "#fca5a5",
            fontSize: 14, lineHeight: 1.6, fontFamily: "sans-serif",
            wordBreak: "break-word",
          }}>
            {saveMsg.text}
          </div>
        </div>
      )}

      {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
      <aside style={{
        width: 300, minWidth: 300, overflowY: "auto",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.015)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.push("/")}
            style={{ background: "none", border: "none", color: "var(--muted, #6b7280)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}>
            ←
          </button>
          <span style={{ color: "white", fontWeight: 600, fontSize: 15 }}>
            {editId ? "Edit Chart" : "New Chart"}
          </span>
        </div>

        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 24, flex: 1 }}>

          {/* 1. Database */}
          <div>
            <SLabel>Database</SLabel>
            {loadingDbs ? (
              <p style={{ fontSize: 13, color: "var(--muted, #6b7280)" }}>Loading...</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
                {databases.map((db) => (
                  <button key={db.id} onClick={() => handleSelectDb(db)}
                    style={{
                      textAlign: "left", padding: "8px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                      background: selectedDb?.id === db.id ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${selectedDb?.id === db.id ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)"}`,
                      color: selectedDb?.id === db.id ? "white" : "var(--muted, #6b7280)",
                      transition: "all 0.15s",
                    }}>
                    {db.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Chart Type */}
          {step >= 2 && (
            <div>
              <SLabel>Chart Type</SLabel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {CHART_TYPES.map(({ value, title, Icon }) => (
                  <button key={value} onClick={() => setChartType(value)} title={title}
                    style={{
                      padding: "12px 0", borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: chartType === value ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.03)",
                      border: `1.5px solid ${chartType === value ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.08)"}`,
                      color: chartType === value ? "white" : "rgba(255,255,255,0.45)",
                    }}>
                    <Icon />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. X / Y Axis */}
          {step >= 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <SLabel>X Axis</SLabel>
                <select value={xField} onChange={(e) => setXField(e.target.value)} style={inputStyle as any}>
                  <option value="">Select field</option>
                  {properties.map((p) => <option key={p.id} value={p.name}>{p.name} ({p.type})</option>)}
                </select>
              </div>
              <div>
                <SLabel>Y Axis</SLabel>
                <select value={yField} onChange={(e) => setYField(e.target.value)} style={inputStyle as any}>
                  <option value="">Select field</option>
                  {properties.map((p) => <option key={p.id} value={p.name}>{p.name} ({p.type})</option>)}
                </select>
              </div>
              <button onClick={handlePreview} disabled={!xField || !yField || loadingPrev}
                style={{
                  padding: "9px 0", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer",
                  background: "rgba(99,102,241,0.25)", border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc",
                  opacity: (!xField || !yField || loadingPrev) ? 0.5 : 1,
                }}>
                {loadingPrev ? "Loading..." : "Preview"}
              </button>
            </div>
          )}

          {/* 4. Color */}
          {step >= 2 && (
            <div>
              <SLabel>Color</SLabel>

              {/* Swatch + Hex */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div onClick={() => colorInputRef.current?.click()}
                    style={{ width: 38, height: 38, background: color, borderRadius: 8, cursor: "pointer",
                      border: "1px solid rgba(255,255,255,0.2)", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }} />
                  <input ref={colorInputRef} type="color" value={color}
                    onChange={(e) => applyColor(e.target.value)}
                    style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer" }} />
                </div>
                <input type="text" value={hexInput} maxLength={7}
                  onChange={(e) => { setHexInput(e.target.value); applyColor(e.target.value); }}
                  style={{ ...inputStyle, fontFamily: "ui-monospace, monospace", flex: 1 }}
                  placeholder="#6366f1"
                />
              </div>

              {/* RGB */}
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {(["R","G","B"] as const).map((ch, i) => (
                  <div key={ch} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <input type="number" min={0} max={255} value={rgb[i]}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(255, Number(e.target.value)));
                        const next: [number,number,number] = [...rgb] as any;
                        next[i] = val;
                        applyRgb(...next);
                      }}
                      style={{ ...numInputStyle, width: "100%" }}
                    />
                    <span style={{ fontSize: 10, color: "var(--muted, #6b7280)" }}>{ch}</span>
                  </div>
                ))}
              </div>

              {/* Preset swatches */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {PRESETS.map((c) => (
                  <button key={c} onClick={() => applyColor(c)}
                    style={{
                      width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer",
                      border: `2px solid ${color === c ? "white" : "transparent"}`,
                      transform: color === c ? "scale(1.2)" : "scale(1)",
                      transition: "all 0.15s", outline: "none",
                    }} />
                ))}
              </div>
            </div>
          )}

          {/* 5. Name & Save */}
          {step >= 3 && previewData.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SLabel>Chart Name</SLabel>
              <input value={chartName} onChange={(e) => setChartName(e.target.value)}
                placeholder={`${selectedDb?.name} - ${yField}`}
                style={inputStyle}
              />
              <button onClick={handleSave} disabled={saving}
                style={{
                  padding: "10px 0", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  border: "none", color: "white", marginTop: 4,
                  opacity: saving ? 0.7 : 1,
                }}>
                {saving ? "Saving..." : editId ? "Update Chart" : "Save Chart"}
              </button>
              {/* inline banner removed — see fullscreen overlay below */}
            </div>
          )}

        </div>
      </aside>

      {/* ── Right: Preview ───────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "28px 32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ color: "white", fontWeight: 600, fontSize: 15 }}>Preview</span>
          {previewData.length > 0 && (
            <span style={{ fontSize: 12, color: "var(--muted, #6b7280)" }}>{previewData.length} entries</span>
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0, borderRadius: 16,
          background: "#191919", border: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
          /* CSS vars for the SVG to consume */
          ["--bg" as any]: "#191919",
          ["--label" as any]: "#6b7280",
          ["--grid" as any]: "rgba(255,255,255,0.08)",
        }}>
          {previewData.length > 0 ? (
            <svg
              viewBox="0 0 800 320"
              preserveAspectRatio="xMidYMid meet"
              style={{ width: "100%", height: "100%", display: "block" }}
              xmlns="http://www.w3.org/2000/svg"
              dangerouslySetInnerHTML={{ __html: renderSvgChart(previewData, color) }}
            />
          ) : (
            <div style={{ textAlign: "center", color: "var(--muted, #6b7280)" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📈</div>
              <p style={{ fontSize: 14 }}>Configure fields then click Preview</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
