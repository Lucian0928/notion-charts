"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ChartPreview } from "@/components/ChartPreview";
import { ChartType } from "@/lib/types";

function EmbedContent() {
  const params = useSearchParams();
  const [data, setData] = useState<{ x: any; y: any }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const databaseId = params.get("databaseId") || "";
  const xField = params.get("xField") || "";
  const yField = params.get("yField") || "";
  const chartType = (params.get("chartType") || "line") as ChartType;
  const color = params.get("color") || "#6366f1";
  const title = params.get("title") || "";

  async function fetchData() {
    const token = localStorage.getItem("notion_token");
    if (!token || !databaseId || !xField || !yField) {
      setError("缺少設定參數或尚未連結 Notion");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/notion/query?databaseId=${databaseId}&xField=${encodeURIComponent(xField)}&yField=${encodeURIComponent(yField)}`,
        { headers: { "x-notion-token": token } }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 5 * 60 * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [databaseId, xField, yField]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-sm" style={{ color: "var(--muted)" }}>載入中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-center p-6">
        <div>
          <p className="text-sm text-red-400 mb-2">{error}</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            請先在同一瀏覽器開啟主頁並連結 Notion
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 min-h-screen" style={{ background: "var(--bg)" }}>
      {title && (
        <h2 className="text-sm font-medium text-white mb-3">{title}</h2>
      )}
      <ChartPreview
        data={data}
        chartType={chartType}
        color={color}
        xField={xField}
        yField={yField}
      />
      <p className="text-right text-xs mt-2" style={{ color: "var(--muted)" }}>
        {data.length} 筆資料 · 每 5 分鐘自動更新
      </p>
    </div>
  );
}

export default function EmbedPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="text-sm" style={{ color: "var(--muted)" }}>載入中...</div>
      </div>
    }>
      <EmbedContent />
    </Suspense>
  );
}
