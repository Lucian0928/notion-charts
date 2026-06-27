"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { renderSvgChart, getViewBox, DEFAULT_MULTI_COLORS } from "@/lib/chartSvg";
import { ChartConfig, ChartType, NotionDatabase, NotionProperty } from "@/lib/types";

const LineIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3,17 8,9 13,13 21,4"/>
    <path d="M3,17 8,9 13,13 21,4 21,20 3,20 Z" fill="currentColor" fillOpacity="0.12" stroke="none"/>
  </svg>
);
const BarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="4" height="10" rx="0.8"/><rect x="10" y="6" width="4" height="15" rx="0.8"/><rect x="17" y="3" width="4" height="18" rx="0.8"/>
  </svg>
);
const PieIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v10l7.4 4.3"/><circle cx="12" cy="12" r="10"/>
  </svg>
);

const CHART_TYPES: { value: ChartType; title: string; Icon: () => React.ReactElement }[] = [
  { value: "line", title: "Line", Icon: LineIcon },
  { value: "bar",  title: "Bar",  Icon: BarIcon  },
  { value: "pie",  title: "Pie",  Icon: PieIcon  },
];

const PRESETS = [
  "#6366f1","#8b5cf6","#a855f7","#ec4899",
  "#f43f5e","#f97316","#f59e0b","#eab308",
  "#22c55e","#10b981","#14b8a6","#06b6d4",
  "#22d3ee","#3b82f6","#64748b","#94a3b8",
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
}
function validHex(h: string) { return /^#[0-9a-f]{6}$/i.test(h); }

function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
      {children}
    </p>
  );
}

export default function BuilderPage() {
  const router        = useRouter();
  const colorInputRef = useRef<HTMLInputElement>(null);
  const multiColorInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [token,          setToken]          = useState("");
  const [editId,         setEditId]         = useState<string | null>(null);
  const [databases,      setDatabases]      = useState<NotionDatabase[]>([]);
  const [selectedDb,     setSelectedDb]     = useState<NotionDatabase | null>(null);
  const [properties,     setProperties]     = useState<NotionProperty[]>([]);
  const [chartType,      setChartType]      = useState<ChartType>("line");
  const [colorMode,      setColorMode]      = useState<"single" | "multi">("single");
  const [multiColors,    setMultiColors]    = useState<string[]>(DEFAULT_MULTI_COLORS);
  const [hoveredColorIdx,setHoveredColorIdx]= useState<number | null>(null);
  const [xField,         setXField]         = useState("");
  const [yField,         setYField]         = useState("");
  const [chartName,      setChartName]      = useState("");
  const [color,          setColor]          = useState(PRESETS[0]);
  const [hexInput,       setHexInput]       = useState(PRESETS[0]);
  const [rgb,            setRgb]            = useState<[number,number,number]>(hexToRgb(PRESETS[0]));
  const [previewData,    setPreviewData]    = useState<{ x: any; y: any }[]>([]);
  const [previewError,   setPreviewError]   = useState<string | null>(null);
  const [previewQueried, setPreviewQueried] = useState(false);
  const [loadingDbs,     setLoadingDbs]     = useState(false);
  const [loadingPrev,    setLoadingPrev]    = useState(false);
  const [step,           setStep]           = useState(1);
  const [saving,         setSaving]         = useState(false);
  const [saveMsg,        setSaveMsg]        = useState<{ ok: boolean; text: string } | null>(null);

  function applyColor(hex: string) {
    if (!validHex(hex)) return;
    setColor(hex); setHexInput(hex); setRgb(hexToRgb(hex));
  }
  function applyRgb(r: number, g: number, b: number) {
    const hex = rgbToHex(r, g, b);
    setColor(hex); setHexInput(hex); setRgb([r, g, b]);
  }

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

  async function loadEditChart(id: string, dbs: NotionDatabase[], t: string) {
    const local: ChartConfig[] = JSON.parse(localStorage.getItem("notion_charts") || "[]");
    const chart = local.find(c => c.id === id);
    if (!chart) return;
    setChartName(chart.name || "");
    setChartType(chart.chartType || "line");
    setColorMode(chart.colorMode || "single");
    setMultiColors(chart.colors?.length ? chart.colors : DEFAULT_MULTI_COLORS);
    applyColor(chart.color || PRESETS[0]);
    setXField(chart.xField || "");
    setYField(chart.yField || "");
    const db = dbs.find(d => d.id === chart.databaseId);
    if (!db) return;
    setSelectedDb(db);
    const [sr, pr] = await Promise.all([
      fetch(`/api/notion/schema?databaseId=${db.id}`, { headers: { "x-notion-token": t } }),
      fetch(`/api/notion/query?databaseId=${db.id}&xField=${encodeURIComponent(chart.xField)}&yField=${encodeURIComponent(chart.yField)}`, { headers: { "x-notion-token": t } }),
    ]);
    const [sj, pj] = await Promise.all([sr.json(), pr.json()]);
    setProperties(sj.properties || []);
    setPreviewData(pj.data || []);
    setPreviewQueried(true);
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
    setLoadingPrev(true); setPreviewError(null); setPreviewQueried(true);
    try {
      const res  = await fetch(`/api/notion/query?databaseId=${selectedDb.id}&xField=${encodeURIComponent(xField)}&yField=${encodeURIComponent(yField)}`, { headers: { "x-notion-token": token } });
      const json = await res.json();
      if (json.error) { setPreviewError(json.error); setPreviewData([]); }
      else {
        setPreviewData(json.data || []);
        if (!(json.data || []).length) setPreviewError("No data — check selected fields.");
        setStep(3);
      }
    } catch (e: any) { setPreviewError(e.message); }
    finally { setLoadingPrev(false); }
  }

  async function handleSave() {
    setSaving(true); setSaveMsg(null);
    try {
      const name   = chartName || `${selectedDb!.name} - ${yField}`;
      const config = { name, databaseId: selectedDb!.id, databaseName: selectedDb!.name, chartType, xField, yField, color, colorMode, colors: multiColors, createdAt: Date.now() };
      const existing: ChartConfig[] = JSON.parse(localStorage.getItem("notion_charts") || "[]");
      if (editId) {
        const updated = existing.map(c => c.id === editId ? { ...c, ...config } : c);
        localStorage.setItem("notion_charts", JSON.stringify(updated));
        const r  = await fetch(`/api/charts?id=${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
        const rj = await r.json();
        if (!rj.ok) throw new Error(rj.error || "PUT failed");
      } else {
        const savedId = crypto.randomUUID();
        const newChart: ChartConfig = { id: savedId, ...config };
        localStorage.setItem("notion_charts", JSON.stringify([...existing, newChart]));
        const r  = await fetch("/api/charts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newChart) });
        const rj = await r.json();
        if (!rj.id) throw new Error(rj.error || "POST failed");
      }
      setSaveMsg({ ok: true, text: "✓ Saved" });
    } catch (e: any) {
      setSaveMsg({ ok: false, text: `✗ ${e.message}` });
    }
    setSaving(false);
    setTimeout(() => router.push("/"), 1800);
  }

  // ── Light-theme shared styles ────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#fff",
    border: "1px solid #e5e7eb", borderRadius: 8,
    padding: "8px 10px", color: "#374151", fontSize: 13, outline: "none",
  };
  const numInputStyle: React.CSSProperties = { ...inputStyle, width: "100%", textAlign: "center", padding: "8px 4px" };

  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: "#f2f2f7" }}>

      {/* Save banner */}
      {saveMsg && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)",
        }}>
          <div style={{
            padding: "20px 28px", borderRadius: 14, maxWidth: 400,
            background: saveMsg.ok ? "#f0fdf4" : "#fef2f2",
            border: `1.5px solid ${saveMsg.ok ? "#86efac" : "#fca5a5"}`,
            color: saveMsg.ok ? "#166534" : "#991b1b",
            fontSize: 14, fontWeight: 500,
          }}>
            {saveMsg.text}
          </div>
        </div>
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside style={{
        width: 300, minWidth: 300, overflowY: "auto",
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        borderRight: "1px solid rgba(0,0,0,0.06)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.push("/")} style={{
            background: "none", border: "none", color: "#6b7280",
            cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 0,
          }}>←</button>
          <span style={{ color: "#111", fontWeight: 700, fontSize: 15 }}>
            {editId ? "Edit Chart" : "Chart Settings"}
          </span>
        </div>

        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 22, flex: 1 }}>

          {/* 1. Database */}
          <div>
            <SLabel>Database</SLabel>
            {loadingDbs ? (
              <p style={{ fontSize: 13, color: "#6b7280" }}>Loading...</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto" }}>
                {databases.map(db => (
                  <button key={db.id} onClick={() => handleSelectDb(db)} style={{
                    textAlign: "left", padding: "8px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                    background: selectedDb?.id === db.id ? "rgba(59,130,246,0.08)" : "rgba(0,0,0,0.02)",
                    border: `1px solid ${selectedDb?.id === db.id ? "rgba(59,130,246,0.35)" : "rgba(0,0,0,0.07)"}`,
                    color: selectedDb?.id === db.id ? "#1d4ed8" : "#374151",
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
                  <button key={value} onClick={() => setChartType(value)} title={title} style={{
                    padding: "11px 0", borderRadius: 9, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: chartType === value ? "rgba(59,130,246,0.08)" : "rgba(0,0,0,0.02)",
                    border: `1.5px solid ${chartType === value ? "#3b82f6" : "rgba(0,0,0,0.08)"}`,
                    color: chartType === value ? "#3b82f6" : "#6b7280",
                    transition: "all 0.15s",
                  }}>
                    <Icon />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. X / Y Axis */}
          {step >= 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <SLabel>X Axis</SLabel>
                <select value={xField} onChange={e => setXField(e.target.value)} style={inputStyle as any}>
                  <option value="">Select field</option>
                  {properties.map(p => <option key={p.id} value={p.name}>{p.name} ({p.type})</option>)}
                </select>
              </div>
              <div>
                <SLabel>Y Axis</SLabel>
                <select value={yField} onChange={e => setYField(e.target.value)} style={inputStyle as any}>
                  <option value="">Select field</option>
                  {properties.map(p => <option key={p.id} value={p.name}>{p.name} ({p.type})</option>)}
                </select>
              </div>
              <button onClick={handlePreview} disabled={!xField || !yField || loadingPrev} style={{
                padding: "9px 0", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer",
                background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: "#3b82f6",
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
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {(["single", "multi"] as const).map(mode => (
                  <button key={mode} onClick={() => setColorMode(mode)} style={{
                    flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 500,
                    cursor: "pointer",
                    background: colorMode === mode ? "rgba(59,130,246,0.08)" : "rgba(0,0,0,0.02)",
                    border: `1.5px solid ${colorMode === mode ? "#3b82f6" : "rgba(0,0,0,0.08)"}`,
                    color: colorMode === mode ? "#3b82f6" : "#6b7280",
                  }}>
                    {mode === "single" ? "Single color" : "Multiple colors"}
                  </button>
                ))}
              </div>

              {colorMode === "single" ? (
                <>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div onClick={() => colorInputRef.current?.click()}
                        style={{ width: 36, height: 36, background: color, borderRadius: 8, cursor: "pointer", border: "1px solid rgba(0,0,0,0.1)" }} />
                      <input ref={colorInputRef} type="color" value={color} onChange={e => applyColor(e.target.value)}
                        style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer" }} />
                    </div>
                    <input type="text" value={hexInput} maxLength={7}
                      onChange={e => { setHexInput(e.target.value); applyColor(e.target.value); }}
                      style={{ ...inputStyle, fontFamily: "ui-monospace, monospace", flex: 1 }}
                      placeholder="#6366f1"
                    />
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    {(["R","G","B"] as const).map((ch, i) => (
                      <div key={ch} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                        <input type="number" min={0} max={255} value={rgb[i]}
                          onChange={e => {
                            const val = Math.max(0, Math.min(255, Number(e.target.value)));
                            const next: [number,number,number] = [...rgb] as any;
                            next[i] = val; applyRgb(...next);
                          }}
                          style={numInputStyle}
                        />
                        <span style={{ fontSize: 10, color: "#9ca3af" }}>{ch}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {PRESETS.map(c => (
                      <button key={c} onClick={() => applyColor(c)} style={{
                        width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer",
                        border: `2px solid ${color === c ? "#111" : "transparent"}`,
                        transform: color === c ? "scale(1.18)" : "scale(1)",
                        transition: "all 0.12s", outline: "none",
                      }} />
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {multiColors.map((c, i) => (
                    <div key={i} style={{ position: "relative" }}
                      onMouseEnter={() => setHoveredColorIdx(i)}
                      onMouseLeave={() => setHoveredColorIdx(null)}>
                      <div onClick={() => multiColorInputRefs.current[i]?.click()}
                        style={{ width: 40, height: 30, background: c, borderRadius: 6, cursor: "pointer", border: "1px solid rgba(0,0,0,0.1)" }} />
                      <input type="color" value={c}
                        onChange={e => { const next = [...multiColors]; next[i] = e.target.value; setMultiColors(next); }}
                        ref={el => { multiColorInputRefs.current[i] = el; }}
                        style={{ position: "absolute", inset: 0, opacity: 0, pointerEvents: "none" }}
                      />
                      {hoveredColorIdx === i && multiColors.length > 1 && (
                        <button onClick={e => { e.stopPropagation(); setMultiColors(multiColors.filter((_, j) => j !== i)); }}
                          style={{
                            position: "absolute", top: -5, right: -5,
                            width: 14, height: 14, borderRadius: "50%",
                            background: "#374151", border: "none", color: "#fff",
                            fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          }}>×</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setMultiColors([...multiColors, PRESETS[multiColors.length % PRESETS.length]])}
                    style={{
                      width: 40, height: 30, borderRadius: 6, cursor: "pointer",
                      background: "rgba(0,0,0,0.03)", border: "1.5px dashed rgba(0,0,0,0.15)",
                      color: "#9ca3af", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>+</button>
                </div>
              )}
            </div>
          )}

          {/* 5. Name & Save */}
          {step >= 3 && previewData.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SLabel>Chart Name</SLabel>
              <input value={chartName} onChange={e => setChartName(e.target.value)}
                placeholder={`${selectedDb?.name} - ${yField}`}
                style={inputStyle}
              />
              <button onClick={handleSave} disabled={saving} style={{
                padding: "10px 0", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer",
                background: saving ? "#e5e7eb" : "#3b82f6",
                border: "none", color: saving ? "#9ca3af" : "#fff", marginTop: 4,
              }}>
                {saving ? "Saving..." : editId ? "Update Chart" : "Save Chart"}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Preview ─────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "28px 32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ color: "#111", fontWeight: 700, fontSize: 16 }}>Preview</span>
          {previewQueried && (
            <span style={{ fontSize: 12, color: previewData.length > 0 ? "#6b7280" : "#ef4444" }}>
              {previewData.length} entries
            </span>
          )}
        </div>

        {previewError && (
          <div style={{
            marginBottom: 12, padding: "10px 14px", borderRadius: 8,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            color: "#dc2626", fontSize: 12, lineHeight: 1.5,
          }}>
            {previewError}
          </div>
        )}

        <div style={{
          flex: 1, minHeight: 0, borderRadius: 16,
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.07)",
          boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
          ["--bg" as any]: "#fff",
          ["--label" as any]: "#6b7280",
          ["--grid" as any]: "rgba(0,0,0,0.07)",
        }}>
          {previewData.length > 0 ? (
            <svg
              viewBox={getViewBox(chartType)}
              preserveAspectRatio="xMidYMid meet"
              style={{ width: "100%", height: "100%", display: "block" }}
              xmlns="http://www.w3.org/2000/svg"
              dangerouslySetInnerHTML={{ __html: renderSvgChart(previewData, color, chartType, colorMode === "multi" ? multiColors : undefined) }}
            />
          ) : (
            <div style={{ textAlign: "center", color: "#9ca3af" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📈</div>
              <p style={{ fontSize: 14, margin: 0 }}>
                {previewQueried ? "No data — try different fields" : "Select database and fields, then click Preview"}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
