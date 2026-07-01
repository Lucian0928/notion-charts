"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChartConfig, NotionDatabase, NotionProperty } from "@/lib/types";

// ── Chart type icons (32 px) ──────────────────────────────────────────────────
const MBarIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="4" height="10" rx="0.6"/><rect x="10" y="6" width="4" height="15" rx="0.6"/><rect x="17" y="3" width="4" height="18" rx="0.6"/>
  </svg>
);
const MLineIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3,17 8,9 13,13 21,4"/><line x1="3" y1="21" x2="21" y2="21"/>
  </svg>
);
const MPieIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v10l7.4 4.3"/><circle cx="12" cy="12" r="10"/>
  </svg>
);
const MHBarIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="10" height="4" rx="0.6"/><rect x="3" y="10" width="16" height="4" rx="0.6"/><rect x="3" y="16" width="7" height="4" rx="0.6"/>
  </svg>
);
const MDoughnutIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5"/><line x1="12" y1="2" x2="12" y2="7"/>
  </svg>
);
const MRadarIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12,2 20,7.5 20,16.5 12,22 4,16.5 4,7.5"/>
    <line x1="12" y1="2" x2="12" y2="12"/><line x1="20" y1="7.5" x2="12" y2="12"/>
    <line x1="20" y1="16.5" x2="12" y2="12"/><line x1="12" y1="22" x2="12" y2="12"/>
    <line x1="4" y1="16.5" x2="12" y2="12"/><line x1="4" y1="7.5" x2="12" y2="12"/>
  </svg>
);
const CHART_TYPES = [
  { id: "bar",      label: "Bar Chart",      Icon: MBarIcon      },
  { id: "line",     label: "Line Chart",     Icon: MLineIcon     },
  { id: "pie",      label: "Pie Chart",      Icon: MPieIcon      },
  { id: "hbar",     label: "Horizontal bar", Icon: MHBarIcon     },
  { id: "doughnut", label: "Doughnut",       Icon: MDoughnutIcon },
  { id: "radar",    label: "Radar Chart",    Icon: MRadarIcon    },
];

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: number }) {
  const steps = [
    { n: 1, label: "Chart type" },
    { n: 2, label: "Notion database" },
    { n: 3, label: "Chart settings" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", marginBottom: 28 }}>
      {steps.map((s, i) => (
        <div key={s.n} style={{ display: "flex", alignItems: "flex-start" }}>
          <div style={{ textAlign: "center", width: 110 }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%", margin: "0 auto 6px",
              background: s.n <= step ? "#3b82f6" : "#e5e7eb",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 700,
              color: s.n <= step ? "#fff" : "#9ca3af",
            }}>{s.n}</div>
            <span style={{ fontSize: 12, fontWeight: s.n === step ? 600 : 400, color: s.n <= step ? "#111" : "#9ca3af" }}>
              {s.label}
            </span>
          </div>
          {i < 2 && (
            <div style={{ flex: 1, height: 1.5, marginTop: 17, minWidth: 40, background: s.n < step ? "#3b82f6" : "#e5e7eb" }} />
          )}
        </div>
      ))}
    </div>
  );
}

function FLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
      {children}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
    </p>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px",
  border: "1px solid #e5e7eb", borderRadius: 8,
  background: "#fff", color: "#374151", fontSize: 13,
  outline: "none", cursor: "pointer", appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
  paddingRight: 32,
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px",
  border: "1px solid #e5e7eb", borderRadius: 8,
  background: "#fff", color: "#374151", fontSize: 13,
  outline: "none",
};

// ── Main modal ────────────────────────────────────────────────────────────────
export function NewChartModal({ onClose }: { onClose: () => void }) {
  const router     = useRouter();
  const token      = useRef("");
  const [step,       setStep]      = useState(1);
  const [selType,    setSelType]   = useState("bar");
  const [databases,  setDatabases] = useState<NotionDatabase[]>([]);
  const [dbSearch,   setDbSearch]  = useState("");
  const [loadingDbs, setLoadingDbs]= useState(false);
  const [selectedDb, setSelectedDb]= useState<NotionDatabase | null>(null);
  const [properties, setProperties]= useState<NotionProperty[]>([]);
  const [xField,     setXField]    = useState("");
  const [yField,     setYField]    = useState("");
  const [chartName,  setChartName] = useState("");
  const [saving,     setSaving]    = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("notion_token") || "";
    token.current = t;
    loadDatabases(t);
  }, []);

  async function loadDatabases(t: string) {
    setLoadingDbs(true);
    try {
      const res  = await fetch("/api/notion/databases", { headers: { "x-notion-token": t } });
      const json = await res.json();
      setDatabases(json.databases || []);
    } finally { setLoadingDbs(false); }
  }

  async function handleSelectDb(db: NotionDatabase) {
    setSelectedDb(db);
    setXField(""); setYField("");
    const res  = await fetch(`/api/notion/schema?databaseId=${db.id}`, { headers: { "x-notion-token": token.current } });
    const json = await res.json();
    setProperties(json.properties || []);
  }

  async function handleCreate() {
    if (!selectedDb || !xField || !yField) return;
    setSaving(true);
    try {
      const name = chartName.trim() || `${selectedDb.name} - ${yField}`;
      const id   = crypto.randomUUID();
      const newChart: ChartConfig = {
        id, name,
        databaseId:   selectedDb.id,
        databaseName: selectedDb.name,
        chartType:    selType as any,
        xField, yField,
        color:        "#6366f1",
        colorMode:    "single",
        colors:       [],
        createdAt:    Date.now(),
      };
      const existing: ChartConfig[] = JSON.parse(localStorage.getItem("notion_charts") || "[]");
      localStorage.setItem("notion_charts", JSON.stringify([...existing, newChart]));
      await fetch("/api/charts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newChart),
      });
      onClose();
      router.push(`/builder?id=${id}`);
    } finally { setSaving(false); }
  }

  const filteredDbs = dbSearch.trim()
    ? databases.filter(d => d.name.toLowerCase().includes(dbSearch.toLowerCase()))
    : databases;

  const canNext2 = !!selectedDb;
  const canCreate = !!xField && !!yField;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.28)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 18,
          width: 680, maxWidth: "95vw", maxHeight: "88vh",
          boxShadow: "0 24px 64px rgba(0,0,0,0.16)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "24px 28px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111" }}>New Chart</h2>
            <button onClick={onClose} style={{
              width: 34, height: 34, borderRadius: 9, border: "1.5px solid #e5e7eb",
              background: "none", cursor: "pointer", color: "#374151",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
            }}>✕</button>
          </div>
          <StepIndicator step={step} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "4px 28px 0" }}>

          {/* Step 1 — Chart type */}
          {step === 1 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, paddingBottom: 4 }}>
              {CHART_TYPES.map(({ id, label, Icon }) => {
                const active = selType === id;
                return (
                  <button key={id} onClick={() => setSelType(id)} style={{
                    padding: "22px 12px 18px",
                    background: active ? "rgba(59,130,246,0.07)" : "#f3f4f6",
                    border: `2px solid ${active ? "#3b82f6" : "transparent"}`,
                    borderRadius: 12, cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                    color: active ? "#3b82f6" : "#374151",
                    transition: "border-color 0.13s, background 0.13s",
                  }}>
                    <Icon />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2 — Database */}
          {step === 2 && (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb" }}>
                <input
                  value={dbSearch}
                  onChange={e => setDbSearch(e.target.value)}
                  placeholder="Search"
                  style={{ flex: 1, padding: "11px 14px", border: "none", outline: "none", fontSize: 13, color: "#374151", background: "#fff" }}
                />
                <button
                  onClick={() => loadDatabases(token.current)}
                  disabled={loadingDbs}
                  style={{
                    padding: "11px 18px", border: "none", borderLeft: "1px solid #e5e7eb",
                    background: "#f9fafb", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151",
                  }}
                >
                  {loadingDbs ? "..." : "Refresh"}
                </button>
              </div>
              <div style={{ maxHeight: 340, overflowY: "auto" }}>
                {filteredDbs.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                    {loadingDbs ? "Loading databases..." : "No databases found"}
                  </div>
                ) : filteredDbs.map((db, i) => (
                  <label key={db.id} onClick={() => handleSelectDb(db)} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 16px",
                    borderBottom: i < filteredDbs.length - 1 ? "1px solid #f3f4f6" : "none",
                    cursor: "pointer", background: selectedDb?.id === db.id ? "#f0f7ff" : "#fff",
                  }}>
                    <span style={{ fontSize: 14, color: "#111", fontWeight: selectedDb?.id === db.id ? 500 : 400 }}>
                      {db.name}
                    </span>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                      border: `2px solid ${selectedDb?.id === db.id ? "#3b82f6" : "#d1d5db"}`,
                      background: selectedDb?.id === db.id ? "#3b82f6" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {selectedDb?.id === db.id && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 — Chart settings */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "4px 60px 4px" }}>
              <div>
                <FLabel>Label</FLabel>
                <input
                  value={chartName}
                  onChange={e => setChartName(e.target.value)}
                  placeholder={selectedDb ? `${selectedDb.name} - ${yField || "value"}` : "Chart name"}
                  style={inputStyle}
                />
              </div>
              <div>
                <FLabel required>X axis</FLabel>
                <select value={xField} onChange={e => setXField(e.target.value)} style={selectStyle as any}>
                  <option value="">Select a column...</option>
                  {properties.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <FLabel required>Y axis</FLabel>
                <select value={yField} onChange={e => setYField(e.target.value)} style={selectStyle as any}>
                  <option value="">Select a column...</option>
                  {properties.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 28px 24px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: "none", fontSize: 14, fontWeight: 600, color: "#374151", cursor: "pointer" }}
            >
              Previous
            </button>
          )}
          {step < 3 && (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 2 && !canNext2}
              style={{
                padding: "9px 28px", borderRadius: 9, border: "none",
                background: step === 2 && !canNext2 ? "#cbd5e1" : "#3b82f6",
                color: "#fff", fontSize: 14, fontWeight: 600,
                cursor: step === 2 && !canNext2 ? "not-allowed" : "pointer",
                boxShadow: step === 2 && !canNext2 ? "none" : "0 2px 12px rgba(59,130,246,0.3)",
              }}
            >
              Next
            </button>
          )}
          {step === 3 && (
            <button
              onClick={handleCreate}
              disabled={!canCreate || saving}
              style={{
                padding: "9px 28px", borderRadius: 9, border: "none",
                background: !canCreate || saving ? "#cbd5e1" : "#3b82f6",
                color: "#fff", fontSize: 14, fontWeight: 600,
                cursor: !canCreate || saving ? "not-allowed" : "pointer",
                boxShadow: !canCreate || saving ? "none" : "0 2px 12px rgba(59,130,246,0.3)",
              }}
            >
              {saving ? "Creating..." : "Create Chart"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
