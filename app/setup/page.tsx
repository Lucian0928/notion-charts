"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleConnect() {
    if (!token.trim()) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/notion/databases", {
        headers: { "x-notion-token": token.trim() },
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Connection failed");

      localStorage.setItem("notion_token", token.trim());
      setStatus("ok");
      setTimeout(() => router.push("/"), 800);
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="glass p-8 w-full max-w-md">
        <div className="mb-8">
          <div className="text-3xl mb-2">📊</div>
          <h1 className="text-2xl font-semibold text-white mb-1">Notion Charts</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            連結你的 Notion workspace 開始建立圖表
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-2" style={{ color: "var(--muted)" }}>
              Notion Integration Token
            </label>
            <input
              type="password"
              className="glass-input"
              placeholder="secret_xxxxxxxxxxxxxxxx"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            />
          </div>

          <a
            href="https://www.notion.so/profile/integrations"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs"
            style={{ color: "var(--accent)" }}
          >
            → 如何取得 Token？前往 Notion Integrations 頁面新增
          </a>

          {status === "error" && (
            <p className="text-sm text-red-400">{errorMsg}</p>
          )}

          {status === "ok" && (
            <p className="text-sm text-green-400">連結成功，跳轉中...</p>
          )}

          <button
            className="btn-primary w-full"
            onClick={handleConnect}
            disabled={status === "loading" || !token.trim()}
          >
            {status === "loading" ? "連線中..." : "連結 Notion"}
          </button>
        </div>

        <div className="mt-6 p-4 rounded-xl text-xs space-y-1" style={{ background: "rgba(255,255,255,0.03)", color: "var(--muted)" }}>
          <p className="font-medium text-white/60">設定步驟</p>
          <p>1. 前往 notion.so/profile/integrations 建立 Integration</p>
          <p>2. 複製 Internal Integration Token</p>
          <p>3. 在 Notion 裡把你的 database Share 給該 Integration</p>
        </div>
      </div>
    </div>
  );
}
